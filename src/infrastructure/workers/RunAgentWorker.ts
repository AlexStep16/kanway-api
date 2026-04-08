import { Worker } from 'bullmq'
import { RemoveMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'

import type { Job } from 'bullmq'
import connectToDatabase from '@db/connectToDatabase.ts'
import { getAgent } from '@/infrastructure/ai/getAgent.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { initializeDependencies } from '../di/initializeDependencies.ts'

import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import dayjs from 'dayjs'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { Types } from 'mongoose'

import * as Sentry from '@sentry/node'
import { Command, CompiledStateGraph } from '@langchain/langgraph'
import getLastHumanMessage from '@/application/ai/helpers/getLastHumanMessage.ts'
import { langgraphQueue } from '../queues/index.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { AgentEventsHandler } from '@/application/ai/callbacks/AgentEventsHandler.ts'
import { getDefaultState } from '@/application/ai/helpers/getDefaultState.ts'

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

  if (messages.length === 0) {
    throw new Error('History is empty, cannot retry.')
  }

  const lastHumanMessage = getLastHumanMessage(messages)

  if (!lastHumanMessage) {
    throw new Error('No user message found to retry from.')
  }

  const lastHumanIndex = messages.findIndex((msg: any) => msg.id === lastHumanMessage.id)

  const messagesToDelete = messages.slice(lastHumanIndex + 1)

  if (messagesToDelete.length > 0) {
    const removeRequests = messagesToDelete.map((msg: any) => new RemoveMessage({ id: msg.id }))

    const updateData: Partial<typeof AgentStateAnnotation.State> = {
      ...getDefaultState(),
      messages: removeRequests,
    }
    await agent.updateState(config, updateData)
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
    }, 500)

    const stepsMessage = await dependencies.services.chatMessageService.getByCriteria(
      { id: configurable.stepMessageId },
      configurable.user.id,
    )

    const agentEventsHandler = new AgentEventsHandler(
      job,
      dependencies.services.chatMessageService,
      dependencies.services.operationLogService,
      configurable,
      stepsMessage[0],
    )

    try {
      const agent = await getAgent(dependencies)

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

        if (!agentEventsHandler.isSynthesizing) continue

        if (eventType === 'on_chat_model_stream') {
          const chunk = event.data.chunk

          if (chunk.content && typeof chunk.content === 'string') {
            accumulatedContent += chunk.content

            if (!agentEventsHandler.aiMessage) {
              await agentEventsHandler.initAiMessage()
            }

            await job.updateProgress({
              role: CustomEvents.UPDATE_MESSAGE,
              data: {
                ...agentEventsHandler.aiMessage,
                content: accumulatedContent,
              },
            })
          }
        }
      }

      await dependencies.services.userService.payCreditsByTokens(
        agentEventsHandler.totalTokensUsed,
        configurable.user.id.toString(),
      )

      return { status: 'completed' }
    } catch (error: any) {
      console.error('Error in RunAgentWorker:', error)

      agentEventsHandler.failSteps(controller.signal.aborted)

      //Sentry.captureException(error, { extra: { jobId: job.id, chatId: configurable?.chatId } })

      try {
        await agentEventsHandler.createErrorMessage(error)

        if (error.name === 'AbortError' || controller.signal.aborted) {
          const agent = await getAgent(dependencies)

          await cleanupLastIteration(agent, config)

          dependencies.services.userService.payCreditsByTokens(
            agentEventsHandler.totalTokensUsed,
            configurable.user.id.toString(),
          )

          throw error
        }
      } catch (dbError) {
        Sentry.captureException(dbError, {
          extra: { jobId: job.id, chatId: configurable?.chatId },
        })
      }

      throw error
    } finally {
      clearInterval(checkInterval)

      await agentEventsHandler.updateStepsMessage()
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
  },
)
