import { ChatMessageDTO } from '@/application/dtos/ChatMessageDTO.js'
import { ChatMessageService } from '@/application/services/ChatMessageService.js'
import { IChatMessage } from '@/domain/entities/IChatMessage.js'
import { IUser } from '@/domain/entities/IUser.js'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Job } from 'bullmq'
import { Configurable } from '../interfaces/Configurable.js'
import { Types } from 'mongoose'
import { IChatMessageCriteria } from '@/application/interfaces/criterias/IChatMessageCriteria.js'
import { getFriendlyErrorMessage } from '@/utils/getFriendlyErrorMessage.js'
import { OperationLogService } from '@/application/services/OperationLogService.js'
import { getCreditsUsed } from '@/utils/getCreditsUsed.js'
import { ChatService } from '@/application/services/ChatService.js'
import { Redis } from 'ioredis'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { IStatus } from '@/application/interfaces/Statuses/IStatus.js'
import { IStatusLog } from '@/application/interfaces/Statuses/IStatusLog.js'

export class AgentEventsHandler extends BaseCallbackHandler {
  name = 'AgentEventsHandler'

  private chatService: ChatService
  private chatMessageService: ChatMessageService
  private operationLogService: OperationLogService
  private job: Job
  private configurable: Configurable

  public aiMessage: IChatMessage | null = null
  public status: IStatus
  public statusMessage: IChatMessage
  public jobHistory: any[] = []
  public totalTokensUsed = 0
  public redisPublisher: Redis
  public modelType = ModelsEnum.KANWAY_LITE
  public chargedAudioTokens = 0

  constructor(
    job: Job,
    chatService: ChatService,
    chatMessageService: ChatMessageService,
    operationLogService: OperationLogService,
    configurable: Configurable,
    statusMessage: IChatMessage,
  ) {
    super()
    this.job = job
    this.chatService = chatService
    this.chatMessageService = chatMessageService
    this.operationLogService = operationLogService
    this.configurable = configurable
    this.statusMessage = statusMessage
    this.modelType = configurable.modelType
    this.chargedAudioTokens = configurable.chargedAudioTokens || 0

    this.status = statusMessage.content

    this.redisPublisher = new Redis()
  }

  async pushProgress(newEvent: any) {
    this.jobHistory.push(newEvent)
    await this.job.updateProgress(this.jobHistory)

    await this.redisPublisher.publish(`job-events:${this.job.id}`, JSON.stringify(newEvent))
  }

  async initAiMessage() {
    this.aiMessage = await this.createChatMessage(
      {
        role: 'assistant',
        content: '',
        threadId: this.configurable.thread_id,
        chatId: new Types.ObjectId(this.configurable.chatId),
      },
      this.configurable.user,
    )
  }

  async createChatMessage(dto: ChatMessageDTO, user: IUser) {
    const createChatMessageResult = await this.chatMessageService.create(dto, user)

    await this.pushProgress({
      id: crypto.randomUUID(),
      role: CustomEvents.NEW_MESSAGE,
      data: createChatMessageResult.data[0],
    })

    return createChatMessageResult.data[0]
  }

  async editChatMessage(dto: Partial<ChatMessageDTO>, criteria: IChatMessageCriteria, user: IUser) {
    const editChatMessageResult = await this.chatMessageService.edit(dto, criteria, user)

    await this.pushProgress({
      id: crypto.randomUUID(),
      role: CustomEvents.UPDATE_MESSAGE,
      data: editChatMessageResult,
    })
  }

  async createErrorMessage(error: any) {
    const userFriendlyMessage = getFriendlyErrorMessage(error)

    const errorMsgDTO: ChatMessageDTO = {
      role: 'error',
      content: `${userFriendlyMessage}`,
      threadId: this.configurable?.thread_id,
      chatId: new Types.ObjectId(this.configurable?.chatId),
    }

    const savedMsg = await this.chatMessageService.create(errorMsgDTO, this.configurable?.user)

    await this.pushProgress({
      id: crypto.randomUUID(),
      role: CustomEvents.NEW_MESSAGE,
      data: {
        ...savedMsg.data[0],
        isError: true,
      },
    })
  }

  completeStatus() {
    this.status.state = StatusStatesEnum.COMPLETED
    this.status.statusText = 'Выполнение завершено'

    this.status.logs.forEach((log) => {
      log.state = StatusStatesEnum.COMPLETED
    })
  }

  async updateStatusMessage() {
    const creditsUsed = getCreditsUsed(this.totalTokensUsed, this.modelType)

    const dto: Partial<ChatMessageDTO> = {
      content: this.status,
      creditsUsed: creditsUsed + this.chargedAudioTokens,
    }

    await this.editChatMessage(
      dto,
      {
        id: this.statusMessage.id.toString(),
      },
      this.configurable.user,
    )
  }

  failStatus(isCancelled = false) {
    if (this.status.state === StatusStatesEnum.IN_PROGRESS) {
      this.status.state = isCancelled ? StatusStatesEnum.CANCELLED : StatusStatesEnum.FAILED
    }
    this.status.logs.forEach((log) => {
      if (log.state === StatusStatesEnum.IN_PROGRESS) {
        log.state = isCancelled ? StatusStatesEnum.CANCELLED : StatusStatesEnum.FAILED
      }
    })
  }

  async updateAssistantMessage(dto: Partial<ChatMessageDTO>) {
    if (!this.aiMessage) return

    await this.editChatMessage(
      dto,
      {
        id: this.aiMessage.id.toString(),
      },
      this.configurable.user,
    )
  }

  async createResolveAmbiguousMessage(ambiguities: {
    call_id: string
    entity_type: 'task' | 'category' | 'board' | 'workspace'
    min_select: number
    max_select: number
    ids: string[]
  }) {
    await this.createChatMessage(
      {
        role: 'ambiguous',
        content: ambiguities,
        threadId: this.configurable?.thread_id,
        chatId: new Types.ObjectId(this.configurable?.chatId),
      },
      this.configurable.user,
    )
  }

  async updateStatus(data: IStatus) {
    Object.assign(this.status, data)

    await this.pushProgress({
      id: crypto.randomUUID(),
      role: CustomEvents.UPDATE_MESSAGE,
      data: {
        ...this.statusMessage,
        content: this.status,
      },
    })
  }

  async updateProgressStatus() {
    await this.pushProgress({
      id: crypto.randomUUID(),
      role: CustomEvents.UPDATE_MESSAGE,
      data: {
        ...this.statusMessage,
        content: this.status,
      },
    })
  }

  async addLog(log: IStatusLog) {
    this.status.logs.push(log)

    await this.updateProgressStatus()
  }

  async updateLog(log: IStatusLog) {
    const logIndex = this.status.logs.findIndex((l) => l.id === log.id)
    if (logIndex !== -1) {
      this.status.logs[logIndex] = log

      await this.updateProgressStatus()
    }
  }

  async handleCustomEvent(event: string, data: any) {
    if (event === CustomEvents.TOKENS_ADDED) {
      this.totalTokensUsed += data || 0
    }

    if (event === CustomEvents.CHAT_UPDATED) {
      const chatEditResult = await this.chatService.edit(
        {
          name: data.name,
        },
        {
          id: this.configurable.chatId,
        },
        this.configurable.user,
      )

      await this.pushProgress({
        id: crypto.randomUUID(),
        role: CustomEvents.CHAT_UPDATED,
        data: chatEditResult[0],
      })
    }

    if (event === CustomEvents.FINAL_RESPONSE) {
      await this.updateAssistantMessage({
        content: data.text,
      })
    }

    if (event === CustomEvents.INTEGRATION) {
      await this.pushProgress({
        id: crypto.randomUUID(),
        role: CustomEvents.INTEGRATION,
        data: data.integration,
      })
    }

    if (event === CustomEvents.DISPLAY) {
      await this.createChatMessage(
        {
          role: 'display',
          content: data,
          threadId: this.configurable.thread_id,
          chatId: new Types.ObjectId(this.configurable.chatId),
        },
        this.configurable.user,
      )
    }

    if (event === CustomEvents.STATUS_ADD_LOG) {
      const logData = data

      await this.addLog(logData)
    }

    if (event === CustomEvents.STATUS_UPDATE_LOG) {
      const logData = data

      const logIndex = this.status.logs.findIndex((log) => log.id === logData.id)
      if (logIndex !== -1) {
        this.status.logs[logIndex] = logData
        await this.updateStatusMessage()
      }
    }

    if (event === CustomEvents.STATUS_UPDATE) {
      await this.updateStatus(data)
    }

    if (event === CustomEvents.OPERATION) {
      const operationLogs = await this.operationLogService.getByCriteria(
        { id: data.logId },
        this.configurable.user.id,
        data.session,
      )

      await this.createChatMessage(
        {
          role: CustomEvents.OPERATION,
          content: data.logId,
          pendingToolCallId: data.toolCallId,
          threadId: this.configurable.thread_id,
          chatId: new Types.ObjectId(this.configurable.chatId),
        },
        this.configurable.user,
      )

      await this.pushProgress({
        id: crypto.randomUUID(),
        role: CustomEvents.OPERATION,
        data: operationLogs[0],
      })
    }
  }
}
