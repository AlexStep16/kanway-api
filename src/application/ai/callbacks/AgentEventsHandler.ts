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

export class AgentEventsHandler extends BaseCallbackHandler {
  name = 'AgentEventsHandler'

  private chatService: ChatService
  private chatMessageService: ChatMessageService
  private operationLogService: OperationLogService
  private job: Job
  private configurable: Configurable

  public aiMessage: IChatMessage | null = null
  public steps: {
    id: string
    name: string
    state: 'in_progress' | 'completed' | 'failed' | 'cancelled'
  }[] = []
  public stepsMessage: IChatMessage
  public jobHistory: any[] = []
  public totalTokensUsed = 0
  public redisClient = new Redis()
  public modelType = ModelsEnum.KANWAY_LITE
  public chargedAudioTokens = 0

  constructor(
    job: Job,
    chatService: ChatService,
    chatMessageService: ChatMessageService,
    operationLogService: OperationLogService,
    configurable: Configurable,
    stepMessage: IChatMessage,
  ) {
    super()
    this.job = job
    this.chatService = chatService
    this.chatMessageService = chatMessageService
    this.operationLogService = operationLogService
    this.configurable = configurable
    this.stepsMessage = stepMessage
    this.modelType = configurable.modelType
    this.chargedAudioTokens = configurable.chargedAudioTokens || 0

    this.steps = Array.isArray(stepMessage.content) ? stepMessage.content : []
  }

  public async pushProgress(newEvent: any) {
    this.jobHistory.push(newEvent)
    await this.job.updateProgress(this.jobHistory)

    await this.redisClient.publish(`job-events:${this.job.id}`, JSON.stringify(newEvent))
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

  completeSteps() {
    this.steps.forEach((step) => {
      if (step.state === 'in_progress') {
        step.state = 'completed'
      }
    })
  }

  async updateStepsMessage() {
    if (this.stepsMessage) {
      const creditsUsed = getCreditsUsed(this.totalTokensUsed, this.modelType)

      const dto: Partial<ChatMessageDTO> = {
        content: this.steps,
        creditsUsed: creditsUsed + this.chargedAudioTokens,
      }

      await this.editChatMessage(
        dto,
        {
          id: this.stepsMessage.id.toString(),
        },
        this.configurable.user,
      )
    }
  }

  failSteps(isCancelled = false) {
    for (const step of this.steps) {
      if (step.state === 'in_progress') {
        step.state = isCancelled ? 'cancelled' : 'failed'
      }
    }
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

  addStep(
    id: string,
    name: string,
    state: 'in_progress' | 'completed' | 'failed' | 'cancelled' = 'in_progress',
  ) {
    const newStep = {
      id: id,
      name: name,
      state: state,
    }

    this.steps.push(newStep)
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

    if (event === CustomEvents.STEP_ADD) {
      const stepData = data

      this.completeSteps()
      this.addStep(stepData.id, stepData.name, stepData.state)

      await this.pushProgress({
        id: crypto.randomUUID(),
        role: CustomEvents.UPDATE_MESSAGE,
        data: {
          ...this.stepsMessage,
          content: this.steps,
        },
      })
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
