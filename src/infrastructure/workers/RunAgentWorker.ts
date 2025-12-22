import { Worker } from 'bullmq'
import { BaseMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'

import type { Job } from 'bullmq'
import connectToDatabase from '@db/connectToDatabase.ts'
import { getAssistantTextFromOutput } from '@utils/getAssistantTextFromOutput.ts'
import { agent } from '@infrastructure/ai/initializeAgent.ts'
import { BullMQCallbackHandler } from '@application/ai/callbacks/BullMQCallbackHandler.ts'
import { AgentRoles } from '@/enums/AgentRoles.ts'
import { initializeDependencies } from '../di/initializeDependencies.ts'
import { ChatMessageDTO } from '@/application/dtos/ChatMessageDTO.ts'

import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import dayjs from 'dayjs'

const dependencies = initializeDependencies()

await connectToDatabase()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)

export const RunAgentWorker = new Worker(
  'langgraph-tasks',
  async (job: Job<{ payload: BaseMessage[] | any; config: RunnableConfig }>) => {
    if (!job.data || !job.data.payload || !job.data.config) {
      throw new Error('Invalid job data')
    }

    const { payload, config } = job.data

    const streamObject =
      payload.lg_name === 'Command'
        ? payload
        : {
            messages: payload,
            relevant_tools: [],
          }

    const bullMQHandler = new BullMQCallbackHandler(job)

    // Используем streamEvents v2
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

      if (eventType === 'on_chain_stream') {
        const intr = event.data.chunk.__interrupt__

        if (intr && intr.length > 0) {
          for (const it of intr) {
            if (it.value && it.value.type === 'confirmation') {
              interruptPayload = it.value

              const toolConfirmations: any[] = []

              if (interruptPayload.data && Array.isArray(interruptPayload.data)) {
                for (const confirmationData of interruptPayload.data) {
                  const toolCall = confirmationData.toolCall

                  let context = {}

                  try {
                    context = JSON.parse(confirmationData.context)
                  } catch {
                    context = confirmationData.context || {}
                  }

                  toolConfirmations.push({
                    callId: toolCall.id,
                    args: toolCall.args || {},
                    functionName: toolCall.name,
                    entityType: confirmationData.entityType,
                    title: confirmationData.title,
                    context,
                  })
                }
              }

              if (toolConfirmations.length > 0) {
                const chatMessage: ChatMessageDTO = {
                  role: AgentRoles.PREVIEW,
                  content: toolConfirmations,
                  threadId: config.configurable?.thread_id,
                  chatId: config.configurable?.chatId,
                }

                const createChatMessageResult =
                  await dependencies.services.chatMessageService.create(
                    chatMessage,
                    config.configurable?.user
                  )

                await job.updateProgress({
                  role: AgentRoles.NEW_MESSAGE,
                  message: createChatMessageResult.data[0],
                })
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
        const chatMessage: ChatMessageDTO = {
          role: AgentRoles.ASSISTANT_FINAL,
          content: finalText,
          threadId: config.configurable?.thread_id,
          chatId: config.configurable?.chatId,
        }

        const createChatMessageResult = await dependencies.services.chatMessageService.create(
          chatMessage,
          config.configurable?.user
        )

        await job.updateProgress({
          role: AgentRoles.NEW_MESSAGE,
          message: createChatMessageResult.data[0],
        })
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
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
  }
)
