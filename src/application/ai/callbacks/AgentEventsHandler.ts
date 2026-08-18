import { ChatMessageDTO } from '@/application/dtos/ChatMessageDTO.js'
import { ChatMessageService } from '@/application/services/ChatMessageService.js'
import { IChatMessage } from '@/domain/entities/IChatMessage.js'
import { IUser } from '@/domain/entities/IUser.js'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Job } from 'bullmq'
import { Configurable } from '../interfaces/Configurable.js'
import { ClientSession, Types } from 'mongoose'
import { IChatMessageCriteria } from '@/application/interfaces/criterias/IChatMessageCriteria.js'
import { getFriendlyErrorMessage } from '@/utils/getFriendlyErrorMessage.js'
import { OperationLogService } from '@/application/services/OperationLogService.js'
import { Redis } from 'ioredis'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { IStatus } from '@/application/interfaces/statuses/IStatus.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { UserService } from '@/application/services/UserService.js'

export class AgentEventsHandler extends BaseCallbackHandler {
  name = 'AgentEventsHandler'

  private chatMessageService: ChatMessageService
  private operationLogService: OperationLogService
  private userService: UserService
  private job: Job
  private configurable: Configurable

  public aiMessage: IChatMessage | null = null
  public status: IStatus
  public statusMessage: IChatMessage
  public jobHistory: any[] = []
  public creditsSpent = 0
  public redisPublisher: Redis
  public modelType = ModelsEnum.GPT_5_4_MINI
  public isInterrupted = false

  constructor(
    job: Job,
    chatMessageService: ChatMessageService,
    operationLogService: OperationLogService,
    userService: UserService,
    configurable: Configurable,
    statusMessage: IChatMessage,
  ) {
    super()
    this.job = job
    this.chatMessageService = chatMessageService
    this.operationLogService = operationLogService
    this.userService = userService
    this.configurable = configurable
    this.statusMessage = statusMessage
    this.modelType = configurable.modelType

    this.status = statusMessage.content

    this.redisPublisher = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    })
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
        iterationId: this.configurable.iterationId,
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

  async completeStatus() {
    this.status.state = StatusStatesEnum.COMPLETED
    this.status.statusText = 'Выполнение завершено'

    await this.updateStatusMessage()
  }

  async updateStatusMessage() {
    const dto: Partial<ChatMessageDTO> = {
      content: this.status,
      creditsUsed: this.creditsSpent + (this.statusMessage.creditsUsed || 0),
    }

    await this.editChatMessage(
      dto,
      {
        id: this.statusMessage.id.toString(),
      },
      this.configurable.user,
    )
  }

  async failStatus(isCancelled = false, error: any) {
    const status = isCancelled ? StatusStatesEnum.CANCELLED : StatusStatesEnum.FAILED

    if (this.status.state === StatusStatesEnum.IN_PROGRESS) {
      this.status.state = status
    }

    this.status.logs.forEach((log) => {
      if (log.state === StatusStatesEnum.IN_PROGRESS) {
        log.state = status
      }
    })

    if (!isCancelled) {
      this.status.statusText = 'Произошла ошибка при выполнении'
      this.status.error = getFriendlyErrorMessage(error)
    }

    await this.updateStatusMessage()
  }

  async updateAssistantMessage(dto: Partial<ChatMessageDTO>) {
    if (!this.aiMessage) return

    await this.editChatMessage(
      {
        ...dto,
      },
      {
        id: this.aiMessage.id.toString(),
      },
      this.configurable.user,
    )
  }

  async updateStatus(data: Partial<IStatus>) {
    Object.assign(this.status, data)

    await this.updateProgressStatus()
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

  async addLog(log: StatusLog) {
    this.status.logs.push(log)

    await this.updateProgressStatus()
  }

  async updateLog(log: StatusLog) {
    const logIndex = this.status.logs.findIndex((l) => l.id === log.id)
    if (logIndex !== -1) {
      this.status.logs[logIndex] = log

      await this.updateProgressStatus()
    }
  }

  async spendCredits() {
    await this.userService.spendCredits(this.creditsSpent, this.configurable.user)
  }

  async handleCustomEvent(event: string, data: any) {
    switch (event) {
      case CustomEvents.FINAL_RESPONSE:
        await this.updateAssistantMessage({
          content: data.text,
        })
        return

      case CustomEvents.STATUS_ADD_LOG:
        await this.addLog(data)
        return

      case CustomEvents.STATUS_UPDATE_LOG:
        await this.updateLog(data)
        await this.updateStatusMessage()
        return

      case CustomEvents.STATUS_UPDATE:
        await this.updateStatus(data)
        return

      case CustomEvents.OPERATION: {
        const operationLogs = await this.operationLogService.getByCriteria(
          { id: data.logId },
          this.configurable.user.id,
          data.session as ClientSession | undefined,
        )

        await this.pushProgress({
          id: crypto.randomUUID(),
          role: CustomEvents.OPERATION,
          data: operationLogs[0],
        })
        return
      }

      default:
        return
    }
  }
}
