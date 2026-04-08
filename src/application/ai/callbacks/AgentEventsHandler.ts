import { ChatMessageDTO } from '@/application/dtos/ChatMessageDTO.ts'
import { ChatMessageService } from '@/application/services/ChatMessageService.ts'
import { IChatMessage } from '@/domain/entities/IChatMessage.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Job } from 'bullmq'
import { Configurable } from '../interfaces/Configurable.ts'
import { Types } from 'mongoose'
import { IChatMessageCriteria } from '@/application/interfaces/criterias/IChatMessageCriteria.ts'
import { getFriendlyErrorMessage } from '@/utils/getFriendlyErrorMessage.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'

export class AgentEventsHandler extends BaseCallbackHandler {
  name = 'AgentEventsHandler'

  private chatMessageService: ChatMessageService
  private operationLogService: OperationLogService
  private job: Job
  private configurable: Configurable

  public isSynthesizing = false
  public aiMessage: IChatMessage | null = null
  public steps: {
    id: string
    name: string
    state: 'in_progress' | 'completed' | 'failed' | 'cancelled'
  }[] = []
  public stepsMessage: IChatMessage
  public totalTokensUsed = 0

  constructor(
    job: Job,
    chatMessageService: ChatMessageService,
    operationLogService: OperationLogService,
    configurable: Configurable,
    stepMessage: IChatMessage,
  ) {
    super()
    this.job = job
    this.chatMessageService = chatMessageService
    this.operationLogService = operationLogService
    this.configurable = configurable
    this.stepsMessage = stepMessage

    this.steps = Array.isArray(stepMessage.content) ? stepMessage.content : []
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
      this.job,
    )
  }

  async createChatMessage(dto: ChatMessageDTO, user: IUser, job: Job) {
    const createChatMessageResult = await this.chatMessageService.create(dto, user)

    await job.updateProgress({
      role: CustomEvents.NEW_MESSAGE,
      data: createChatMessageResult.data[0],
    })

    return createChatMessageResult.data[0]
  }

  async editChatMessage(
    dto: Partial<ChatMessageDTO>,
    criteria: IChatMessageCriteria,
    user: IUser,
    job: Job,
  ) {
    const editChatMessageResult = await this.chatMessageService.edit(dto, criteria, user)

    await job.updateProgress({
      role: CustomEvents.UPDATE_MESSAGE,
      data: editChatMessageResult,
    })
  }

  async createErrorMessage(error: any) {
    const userFriendlyMessage = getFriendlyErrorMessage(error)

    const errorMsgDTO: ChatMessageDTO = {
      role: 'error',
      content: `😔 ${userFriendlyMessage}`,
      threadId: this.configurable?.thread_id,
      chatId: new Types.ObjectId(this.configurable?.chatId),
    }

    const savedMsg = await this.chatMessageService.create(errorMsgDTO, this.configurable?.user)

    await this.job.updateProgress({
      role: CustomEvents.NEW_MESSAGE,
      data: {
        ...savedMsg.data[0],
        isError: true,
      },
    })
  }

  async updateStepsMessage() {
    this.steps.forEach((step) => {
      if (step.state === 'in_progress') {
        step.state = 'completed'
      }
    })

    if (this.stepsMessage) {
      await this.editChatMessage(
        {
          content: this.steps,
        },
        {
          id: this.stepsMessage.id.toString(),
        },
        this.configurable.user,
        this.job,
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

  async updateAssistantMessage(content: string) {
    if (!this.aiMessage) return

    await this.editChatMessage(
      {
        role: 'assistant',
        content: content,
        threadId: this.configurable?.thread_id,
        chatId: new Types.ObjectId(this.configurable?.chatId),
      },
      {
        id: this.aiMessage.id.toString(),
      },
      this.configurable.user,
      this.job,
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
      this.job,
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

    if (event === CustomEvents.FINAL_RESPONSE) {
      await this.updateAssistantMessage(data.text)
    }

    if (event === CustomEvents.INTEGRATION) {
      await this.job.updateProgress({
        role: CustomEvents.INTEGRATION,
        data: data.integration,
      })
    }

    if (event === CustomEvents.SYNTHESIZE_START) {
      this.isSynthesizing = true
    }

    if (event === CustomEvents.SYNTHESIZE_END) {
      this.isSynthesizing = false
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
        this.job,
      )
    }

    if (event === CustomEvents.STEP_ADD) {
      const stepData = data

      this.steps.forEach((step) => {
        if (step.state === 'in_progress') {
          step.state = 'completed'
        }
      })

      this.addStep(stepData.id, stepData.name)

      await this.job.updateProgress({
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
        this.job,
      )

      await this.job.updateProgress({
        role: CustomEvents.OPERATION,
        data: operationLogs[0],
      })
    }
  }
}
