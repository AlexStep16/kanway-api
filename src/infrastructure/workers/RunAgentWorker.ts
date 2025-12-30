import { Worker } from 'bullmq'
import { BaseMessage, RemoveMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'

import type { Job } from 'bullmq'
import connectToDatabase from '@db/connectToDatabase.ts'
import { getAssistantTextFromOutput } from '@utils/getAssistantTextFromOutput.ts'
import { getAgent } from '@/infrastructure/ai/getAgent.ts'
import { BullMQCallbackHandler } from '@application/ai/callbacks/BullMQCallbackHandler.ts'
import { AgentRoles } from '@/enums/AgentRoles.ts'
import { initializeDependencies } from '../di/initializeDependencies.ts'
import { ChatMessageDTO } from '@/application/dtos/ChatMessageDTO.ts'
import { AgentStateAnnotation } from '@application/ai/agent/AgentStateAnnotation.ts'

import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import dayjs from 'dayjs'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { Types } from 'mongoose'
import { parseToolConfirmations } from '../helpers/parseToolConfirmations.ts'

import * as Sentry from '@sentry/node'
import { getFriendlyErrorMessage } from '@/utils/getFriendlyErrorMessage.ts'
import { Command } from '@langchain/langgraph'
import getLastHumanMessage from '@application/ai/helpers/getLastHumanMessage.ts'
import { IUser } from '@/domain/entities/IUser.ts'

const dependencies = initializeDependencies()

Sentry.init({
  dsn: 'https://2aa4717bdc17380896b4b44e49d09363@o4510595293249536.ingest.de.sentry.io/4510595296264272',

  // Send structured logs to Sentry
  enableLogs: true,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
})

await connectToDatabase()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)
dayjs.extend(customParseFormat)

async function createChatMessage(dto: ChatMessageDTO, user: IUser, job: Job) {
  const createChatMessageResult = await dependencies.services.chatMessageService.create(dto, user)

  await job.updateProgress({
    role: AgentRoles.NEW_MESSAGE,
    message: createChatMessageResult.data[0],
  })
}

export const RunAgentWorker = new Worker(
  'langgraph-tasks',
  async (
    job: Job<{ payload: BaseMessage[] | Command; config: RunnableConfig; isRetry: boolean }>
  ) => {
    if (!job.data || !job.data.payload || !job.data.config) {
      throw new Error('Invalid job data')
    }

    const { payload, config, isRetry } = job.data
    const configurable = config.configurable as Configurable

    try {
      const streamObject =
        payload instanceof Command
          ? payload
          : {
              messages: payload,
              relevant_tools: [],
            }

      const bullMQHandler = new BullMQCallbackHandler(job)

      // Используем streamEvents v2
      const agent = await getAgent(dependencies)

      if (isRetry) {
        const currentState = await agent.getState(config)
        const messages = currentState.values.messages || []

        if (messages.length === 0) {
          throw new Error('History is empty, cannot retry.')
        }

        // 4. Ищем последнее сообщение пользователя
        const lastHumanMessage = getLastHumanMessage(messages)

        if (!lastHumanMessage) {
          throw new Error('No user message found to retry from.')
        }

        const lastHumanIndex = messages.findIndex((msg: any) => msg.id === lastHumanMessage.id)

        // 5. Определяем "мусор", который нужно удалить
        // Это всё, что идет ПОСЛЕ последнего сообщения юзера (ToolCalls, ToolMessages, Partial AI responses)
        const messagesToDelete = messages.slice(lastHumanIndex + 1)

        // 6. Удаляем мусор из стейта LangGraph
        if (messagesToDelete.length > 0) {
          const removeRequests = messagesToDelete.map(
            (msg: any) => new RemoveMessage({ id: msg.id })
          )

          // updateState применяет изменения к текущему треду
          const updateData: typeof AgentStateAnnotation.State = {
            messages: removeRequests,
            relevant_tools: [],
            tools_confirmed: [],
            tools_cancelled: [],
            tools_validation_errors: [],
            validation_failed: false,
            planner_has_error: false,
            plan: [],
          }
          await agent.updateState(config, updateData)
        }
      }

      const stream: any = agent.streamEvents(streamObject, {
        ...config,
        callbacks: [bullMQHandler],
        version: 'v2',
      })

      let interrupted = false
      let interruptPayload: any = null
      let finalEvent: any = null
      let isSynthesizeStarted = false

      for await (const event of stream) {
        const eventType = event.event

        if (event.name === AgentRoles.SYNTHESIZE_START) {
          isSynthesizeStarted = true
        }

        if (event.name === AgentRoles.LIST_ENTITIES) {
          const data = event.data

          await createChatMessage(
            {
              role: AgentRoles.LIST_ENTITIES,
              content: data.entities,
              listType: data.type,
              threadId: configurable.thread_id,
              chatId: Types.ObjectId.createFromHexString(configurable.chatId),
            },
            configurable.user,
            job
          )
        }

        if (eventType === 'on_chain_stream') {
          const intr = event.data.chunk.__interrupt__

          if (intr && intr.length > 0) {
            for (const it of intr) {
              if (it.value && it.value.type === 'confirmation') {
                interruptPayload = it.value

                const toolConfirmations: any[] = parseToolConfirmations(interruptPayload)

                if (toolConfirmations.length > 0) {
                  await createChatMessage(
                    {
                      role: AgentRoles.PREVIEW,
                      content: toolConfirmations,
                      threadId: configurable.thread_id,
                      chatId: Types.ObjectId.createFromHexString(configurable.chatId),
                    },
                    configurable.user,
                    job
                  )
                }

                interrupted = true
              }
            }
          }
        }

        finalEvent = event

        if (interrupted) break // при первом interrupt выходим (пусть фронт решает confirm/cancel)

        if (!isSynthesizeStarted) continue

        if (eventType === 'on_chat_model_stream') {
          const chunk = event.data.chunk

          if (chunk.content && typeof chunk.content === 'string') {
            await job.updateProgress({
              role: AgentRoles.ASSISTANT_CHUNK,
              content: chunk.content,
            })
          }
        }
      }

      // Критично для резюме/отмены: финальный результат лежит в on_chain_end -> data.output
      if (finalEvent) {
        const lastOutput = finalEvent.data.output

        const finalText = getAssistantTextFromOutput(lastOutput)

        if (finalText && finalText.trim()) {
          await createChatMessage(
            {
              role: AgentRoles.ASSISTANT_FINAL,
              content: finalText,
              threadId: configurable?.thread_id,
              chatId: Types.ObjectId.createFromHexString(configurable?.chatId),
            },
            configurable?.user,
            job
          )
        }
      }

      if (interrupted) {
        // Возвращаем конфиг — фронт/бэк используют его для resume с тем же thread_id
        return {
          status: 'interrupted',
          interrupt: interruptPayload,
        }
      }

      // Если не было interrupt, считаем выполнение завершённым
      // lastOutput уже обработан в on_chain_end; просто возвращаем completed
      return { status: 'completed', message: 'Агент завершил свою работу.' }
    } catch (error) {
      //Sentry.captureException(error, { extra: { jobId: job.id, chatId: configurable?.chatId } })

      const userFriendlyMessage = getFriendlyErrorMessage(error)

      // 3. СОХРАНЕНИЕ В БАЗУ
      // Пользователь должен увидеть ответ в чате, чтобы не ждать бесконечно
      try {
        const errorMsgDTO: ChatMessageDTO = {
          role: 'error',
          // Добавляем иконку, чтобы визуально отличить от нормального ответа
          content: `😔 ${userFriendlyMessage}`,
          threadId: configurable?.thread_id,
          chatId: Types.ObjectId.createFromHexString(configurable?.chatId),
        }

        const savedMsg = await dependencies.services.chatMessageService.create(
          errorMsgDTO,
          configurable?.user
        )

        // 4. УВЕДОМЛЕНИЕ ФРОНТЕНДА
        await job.updateProgress({
          role: AgentRoles.NEW_MESSAGE,
          message: {
            ...savedMsg.data[0],
            isError: true,
          },
        })
      } catch (dbError) {
        Sentry.captureException(dbError, {
          extra: { jobId: job.id, chatId: configurable?.chatId },
        })
      }

      throw error
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
  }
)
