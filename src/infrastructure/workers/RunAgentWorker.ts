import { Worker } from 'bullmq'
import { HumanMessage, RemoveMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'

import type { Job } from 'bullmq'
import connectToDatabase from '@db/connectToDatabase.js'
import { getAgent } from '@/infrastructure/ai/getAgent.js'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { initializeDependencies } from '../di/initializeDependencies.js'

import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import dayjs from 'dayjs'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { Types } from 'mongoose'

import * as Sentry from '@sentry/node'
import { Command, CompiledStateGraph } from '@langchain/langgraph'
import getLastHumanMessage from '@/application/ai/helpers/getLastHumanMessage.js'
import { langgraphQueue } from '../queues/index.js'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { AgentEventsHandler } from '@/application/ai/callbacks/AgentEventsHandler.js'
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'

const proxyAgent = new EnvHttpProxyAgent()
if (process.env.NODE_ENV === 'production') setGlobalDispatcher(proxyAgent)

const dependencies = initializeDependencies()

Sentry.init({
  dsn: 'https://2aa4717bdc17380896b4b44e49d09363@o4510595293249536.ingest.de.sentry.io/4510595296264272',
  enableLogs: true,
  sendDefaultPii: true,
})

await connectToDatabase()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)
dayjs.extend(customParseFormat)

async function cleanupLastIteration(agent: CompiledStateGraph<any, any>, config: RunnableConfig) {
  const currentState = await agent.getState(config)
  const messages = currentState.values.messages || []

  const configurable = config.configurable as Configurable

  if (messages.length === 0) {
    messages.push(new HumanMessage(configurable.userMessage))

    return await agent.updateState(config, {
      messages,
    })
  }

  const lastHumanMessage = getLastHumanMessage(messages)

  if (!lastHumanMessage) {
    throw new Error('No user message found to retry from.')
  }

  const lastHumanIndex = messages.findIndex((msg: any) => msg.id === lastHumanMessage.id)

  const messagesToDelete = messages.slice(lastHumanIndex + 1)

  if (messagesToDelete.length > 0) {
    const removeRequests = messagesToDelete.map((msg: any) => new RemoveMessage({ id: msg.id }))

    await agent.updateState(config, {
      messages: removeRequests,
    })
  }
}

export const RunAgentWorker = new Worker(
  'langgraph-tasks',
  async (
    job: Job<{
      payload: Partial<typeof AgentStateAnnotation.State> | Command
      config: RunnableConfig
      isRetry: boolean
    }>,
  ) => {
    if (!job.data || !job.data.payload || !job.data.config) {
      throw new Error('Invalid job data')
    }

    const controller = new AbortController()

    const { payload, config, isRetry } = job.data

    const configurable = config.configurable as Configurable

    configurable.jobId = job.id

    if (config.configurable && typeof config.configurable.user.id === 'string') {
      configurable.user.id = new Types.ObjectId(configurable.user.id)
    }

    const checkInterval = setInterval(async () => {
      try {
        const freshJob = await langgraphQueue.getJob(job.id || '')

        if (freshJob && freshJob.data && freshJob.data.__abortSignal) {
          controller.abort()
          clearInterval(checkInterval)
        }
      } catch (err) {
        Sentry.captureException(err, { extra: { jobId: job.id } })
      }
    }, 100)

    const stepsMessage = await dependencies.services.chatMessageService.getByCriteria(
      { id: configurable.stepMessageId },
      configurable.user.id,
    )

    const agentEventsHandler = new AgentEventsHandler(
      job,
      dependencies.services.chatService,
      dependencies.services.chatMessageService,
      dependencies.services.operationLogService,
      configurable,
      stepsMessage[0],
    )

    try {
      agentEventsHandler.initSubscriber()

      const agent = await getAgent(dependencies)

      const updateData: Partial<typeof AgentStateAnnotation.State> = {
        messages: [new HumanMessage(configurable.userMessage)],
      }
      await agent.updateState(config, updateData)

      if (isRetry) {
        await cleanupLastIteration(agent, config)
      }

      const stream: any = agent.streamEvents(payload, {
        ...config,
        version: 'v2',
        callbacks: [agentEventsHandler],
        signal: controller.signal,
      })

      let accumulatedContent = ''

      for await (const event of stream) {
        const eventType = event.event

        if (event.name === CustomEvents.AMBIGUITY_RESOLUTION) {
          const eventData = event.data

          await agentEventsHandler.createResolveAmbiguousMessage(eventData)

          break
        }

        if (eventType === 'on_chat_model_stream') {
          const chunk = event.data.chunk

          if (
            chunk.content &&
            typeof chunk.content === 'string' &&
            event.metadata?.langgraph_node === 'Orchestrator'
          ) {
            accumulatedContent += chunk.content

            if (!agentEventsHandler.aiMessage) {
              await agentEventsHandler.initAiMessage()
            }

            await agentEventsHandler.pushProgress({
              id: crypto.randomUUID(),
              role: CustomEvents.UPDATE_MESSAGE,
              data: {
                ...agentEventsHandler.aiMessage,
                content: accumulatedContent,
              },
            })
          }
        }
      }

      return { status: 'completed' }
    } catch (error: any) {
      console.error('Error in RunAgentWorker:', error)

      agentEventsHandler.failSteps(controller.signal.aborted)

      //Sentry.captureException(error, { extra: { jobId: job.id, chatId: configurable?.chatId } })

      if (error.name === 'AbortError' || controller.signal.aborted) throw error

      try {
        await agentEventsHandler.pushProgress({
          id: crypto.randomUUID(),
          status: 'failed',
        })

        await agentEventsHandler.createErrorMessage(error)
      } catch (dbError) {
        Sentry.captureException(dbError, {
          extra: { jobId: job.id, chatId: configurable?.chatId },
        })
      }

      throw error
    } finally {
      dependencies.services.userService.spendCredits(
        agentEventsHandler.totalTokensUsed,
        configurable.user.id.toString(),
        configurable.modelType,
      )

      clearInterval(checkInterval)

      const agent = await getAgent(dependencies)

      const currentState = await agent.getState(config)

      const finalMessages = currentState.values.final_messages || []

      const updateData: Partial<typeof AgentStateAnnotation.State> = {
        messages: finalMessages,
      }
      await agent.updateState(config, updateData)

      agentEventsHandler.completeSteps()
      await agentEventsHandler.updateStepsMessage()

      await agentEventsHandler.pushProgress({
        id: crypto.randomUUID(),
        status: 'completed',
      })
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
  },
)
