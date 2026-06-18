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
import { AgentEventsHandler } from '@/application/ai/callbacks/AgentEventsHandler.js'
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'
import { AgentWorkerDTO } from '@/application/dtos/AgentWorkerDTO.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { IStatus } from '@/application/interfaces/statuses/IStatus.js'
import { calculateCredits } from '@/application/ai/helpers/calculateCredits.js'

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

class JobAbortedError extends Error {
  constructor() {
    super('Job execution aborted')
    this.name = 'JobAbortedError'
  }
}

function createAbortWatcher(jobId: string | undefined, controller: AbortController) {
  let isCancelled = false

  const abort = () => {
    isCancelled = true

    if (!controller.signal.aborted) {
      controller.abort()
    }
  }

  const interval = setInterval(async () => {
    try {
      if (!jobId) {
        return
      }

      const freshJob = await langgraphQueue.getJob(jobId)

      if (freshJob?.data?.__abortSignal) {
        abort()
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { jobId } })
    }
  }, 100)

  return {
    abort,
    stop() {
      clearInterval(interval)
    },
    isCancelled() {
      return isCancelled || controller.signal.aborted
    },
  }
}

export const RunAgentWorker = new Worker(
  'langgraph-tasks',
  async (job: Job<AgentWorkerDTO>) => {
    if (!job.data || !job.data.payload || !job.data.config) {
      throw new Error('Invalid job data')
    }

    const controller = new AbortController()
    const abortWatcher = createAbortWatcher(job.id, controller)

    const { payload, config, isRetry, isResume } = job.data

    const configurable = config.configurable as Configurable

    configurable.jobId = job.id

    if (config.configurable && typeof config.configurable.user.id === 'string') {
      configurable.user.id = new Types.ObjectId(configurable.user.id)
    }

    const statusMessage = await dependencies.services.chatMessageService.getByCriteria(
      { id: configurable.statusMessageId },
      configurable.user.id,
    )

    const agentEventsHandler = new AgentEventsHandler(
      job,
      dependencies.services.chatMessageService,
      dependencies.services.operationLogService,
      dependencies.services.userService,
      configurable,
      statusMessage[0],
    )

    let hasExecutionError = false
    let wasCancelled = false
    let isInterrupted = false

    try {
      const initialStatus: Partial<IStatus> = {
        state: StatusStatesEnum.IN_PROGRESS,
        error: '',
      }

      if (isRetry) {
        initialStatus.logs = agentEventsHandler.status.logs.filter(() => false)
      }

      await agentEventsHandler.updateStatus(initialStatus)

      const agent = await getAgent(dependencies)

      const currentState = await agent.getState(config)

      if (
        currentState.values.user_message === configurable.userMessage &&
        currentState.values.operation_log_ids &&
        currentState.values.operation_log_ids.size > 0 &&
        isRetry
      ) {
        const operationLogIds =
          currentState.values.operation_log_ids.get(configurable.iterationId) || []

        await dependencies.services.operationLogService.undoOperations(
          operationLogIds,
          configurable.user,
        )

        await agentEventsHandler.pushProgress({
          id: crypto.randomUUID(),
          role: CustomEvents.OPERATION,
          data: operationLogIds[0],
        })
      }

      if (isRetry) {
        await cleanupLastIteration(agent, config)
      }

      const stream = await agent.streamEvents(
        isResume ? new Command({ resume: payload }) : payload,
        {
          ...config,
          version: 'v3',
          callbacks: [agentEventsHandler],
          signal: controller.signal,
        },
      )

      let accumulatedContent = ''

      for await (const message of stream.messages) {
        for await (const delta of message.text) {
          if (message.node?.toLowerCase() !== 'orchestrator') continue

          accumulatedContent += delta

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

        if (abortWatcher.isCancelled()) {
          throw new JobAbortedError()
        }

        const usage = await message.usage

        if (usage) {
          const creditsSpent = calculateCredits(usage, configurable.modelType)

          agentEventsHandler.creditsSpent += creditsSpent
        }
      }

      if (stream.interrupted) {
        await agentEventsHandler.updateStatus({
          state: StatusStatesEnum.AWAITING_CONFIRMATION,
        })

        isInterrupted = true
      }

      return { status: 'completed' }
    } catch (error: any) {
      wasCancelled =
        error?.name === 'AbortError' ||
        error?.name === 'JobAbortedError' ||
        abortWatcher.isCancelled()

      if (wasCancelled) {
        await agentEventsHandler.failStatus(true, error)

        throw error
      }

      console.error('Error in RunAgentWorker:', error)
      hasExecutionError = true

      await agentEventsHandler.failStatus(false, error)

      //Sentry.captureException(error, { extra: { jobId: job.id, chatId: configurable?.chatId } })

      throw error
    } finally {
      if (!hasExecutionError && !wasCancelled) {
        await agentEventsHandler.spendCredits()
      }

      abortWatcher.stop()

      const shouldMarkAsCompleted = !isInterrupted && !hasExecutionError && !wasCancelled

      if (shouldMarkAsCompleted) {
        await agentEventsHandler.completeStatus()
      }

      await agentEventsHandler.updateStatusMessage()

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
