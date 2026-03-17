import ChatRepository from '@repositories/ChatRepository.ts'
import { ChatDTO } from '@dtos/ChatDTO.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { OperationLogService } from './OperationLogService.ts'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@/domain/enums/CollectionsEnum.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IChat } from '@domain/entities/IChat.ts'
import { IChatCriteria } from '@interfaces/criterias/IChatCriteria.ts'
import { ChatSendDTO } from '@dtos/ChatSendDTO.ts'
import { BaseMessage, HumanMessage } from '@langchain/core/messages'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.ts'
import { ChatMessageService } from '@application/services/ChatMessageService.ts'
import { RunnableConfig } from '@langchain/core/runnables'
import dayjs from 'dayjs'
import { langgraphQueue } from '@/infrastructure/queues/index.ts'
import { ApproveLogDTO } from '@dtos/ApproveLogDTO.ts'
import { Command } from '@langchain/langgraph'
import { SettingService } from '@application/services/SettingService.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { RetryAgentDTO } from '@dtos/RetryAgentDTO.ts'
import { StopAgentDTO } from '@dtos/StopAgentDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { AppError } from '@errors/AppError.ts'
import { BaseService } from '@application/services/BaseService.ts'
import { IChatRaw } from '@entities/IChatRaw.ts'
import { IChatMessage } from '@/domain/entities/IChatMessage.ts'
import { BoardService } from './BoardService.ts'
import { WorkspaceService } from './WorkspaceService.ts'
import { AgentStateAnnotation } from '../aiNew/agent/AgentStateAnnotation.ts'
import { ResolveAmbiguousDTO } from '../dtos/ResolveAmbiguousDTO.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'

const MAX_RETRIES = 3

export class ChatService extends BaseService<IChatRaw, IChat, IChatCriteria> {
  protected repository: ChatRepository
  protected operationLogService: OperationLogService
  protected chatMessageService: ChatMessageService
  protected settingService: SettingService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService
  protected contextExternalFetchService: ContextExternalFetchService

  constructor(
    chatRepository: ChatRepository,
    operationLogService: OperationLogService,
    chatMessageService: ChatMessageService,
    settingService: SettingService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
    contextExternalFetchService: ContextExternalFetchService,
  ) {
    super(chatRepository)

    this.repository = chatRepository
    this.operationLogService = operationLogService
    this.chatMessageService = chatMessageService
    this.settingService = settingService
    this.boardService = boardService
    this.workspaceService = workspaceService
    this.contextExternalFetchService = contextExternalFetchService
  }

  private async _getConfigurableFromUserSetting(
    user: IUser,
    data: {
      threadId: string
      chatId: string
      boardId?: string
      workspaceId: string
      timezone: string
      stepMessageId: string
    },
  ): Promise<RunnableConfig<Configurable>> {
    const userSettings = await this.settingService.getByCriteria({}, user.id)
    const userSetting = userSettings[0]

    let activeBoardName = ''
    let activeWorkspaceName = ''

    const activeBoard = data.boardId
      ? await this.boardService.getByCriteria({ id: data.boardId }, user.id)
      : null

    const activeWorkspace = data.workspaceId
      ? await this.workspaceService.getByCriteria({ id: data.workspaceId }, user.id)
      : null

    if (activeBoard && activeBoard.length > 0) {
      activeBoardName = activeBoard[0].name
    }

    if (activeWorkspace && activeWorkspace.length > 0) {
      activeWorkspaceName = activeWorkspace[0].name
    }

    const config: RunnableConfig<Configurable> = {
      recursionLimit: 25,
      configurable: {
        thread_id: data.threadId,
        user,
        chatId: data.chatId,
        activeBoardId: data.boardId,
        activeBoardName,
        activeWorkspaceId: data.workspaceId,
        activeWorkspaceName,
        currentDate: dayjs.tz(dayjs(), data.timezone).toISOString(),
        timezone: data.timezone,

        aiName: userSetting.aiName || 'Kanbar',
        aiConfirmationType: userSetting.aiConfirmationType,
        defaultCategoryName: userSetting.aiDefaultCategory,
        defaultBoardName: userSetting.aiDefaultBoard,
        stepMessageId: data.stepMessageId,
      },
    }

    return config
  }

  private async _retryExecutor<T>(executor: (session: ClientSession) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const session = await mongoose.startSession()
      session.startTransaction()
      try {
        const result = await executor(session)

        await session.commitTransaction()

        return result
      } catch (error: any) {
        await session.abortTransaction()

        if (error.code === 112 && attempt < MAX_RETRIES) {
          console.warn(`Конфликт записи в базу данных ${attempt}. Повторная попытка...`)

          await new Promise((resolve) => setTimeout(resolve, 50 * attempt))
          continue
        }

        throw error
      } finally {
        session.endSession()
      }
    }
    throw new AppError(
      'Произошла ошибка при выполнении операции после максимального количества попыток.',
      500,
    )
  }

  private async _executeSendTransaction(
    data: ChatSendDTO,
    user: IUser,
    externalSession?: ClientSession,
  ) {
    let chat: IChat | null = null
    let toolsWithNoDecision = 0

    const messages: BaseMessage[] = []
    const newChatMessages: IChatMessage[] = []
    const threadId = data.threadId || new Types.ObjectId().toString()

    if (user.subscriptionId === SubscriptionPlanEnum.Basic && user.generationsCount === 0) {
      throw new AppError('Достигнут лимит генераций для вашего плана подписки.', 403)
    }

    if (!data.threadId) {
      const createResult = await this.create(
        {
          name: data.message?.slice(0, 500) || 'Новый чат',
          workspaceId: data.workspaceId,
          threadId,
        },
        user,
      )

      chat = createResult.data[0]
    } else {
      const getChatResult = await this.getByCriteria({ threadId }, user.id, externalSession)

      chat = getChatResult[0]
    }

    const chatMessages = await this.chatMessageService.getByCriteria(
      { chatId: chat.id.toString() },
      user.id,
      externalSession,
    )

    for (const chatMessage of chatMessages) {
      if (chatMessage.role === 'operation') {
        const logId: string = chatMessage.content

        if (!logId) continue

        const logs = await this.operationLogService.getByCriteria(
          {
            id: logId,
          },
          user.id,
          externalSession,
        )

        if (logs && logs.length > 0) {
          const log = logs[0]

          if (log.status === OperationLogStatusesEnum.PENDING) {
            toolsWithNoDecision += 1
          }
        }
      }
    }

    if (toolsWithNoDecision > 0) {
      throw new AppError('Не все действия подтверждены или отменены.', 400)
    }

    if (data.message) {
      const userMessage = await this.chatMessageService.create(
        {
          role: 'user',
          content: data.message,
          chatId: chat.id,
          threadId,
        },
        user,
        externalSession,
      )

      newChatMessages.push(...userMessage.data)

      messages.push(new HumanMessage(data.message))
    } else if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role !== 'user') {
      throw new AppError('Последнее сообщение в чате не является сообщением от пользователя.', 400)
    }

    const stepsMessage = await this.chatMessageService.create(
      {
        role: 'steps',
        content: [],
        threadId: threadId,
        chatId: chat.id,
      },
      user,
    )

    const config = await this._getConfigurableFromUserSetting(user, {
      threadId: threadId,
      chatId: chat.id.toString(),
      boardId: data.boardId,
      workspaceId: data.workspaceId,
      timezone: data.timezone,
      stepMessageId: stepsMessage.data[0].id.toHexString(),
    })

    const jobPayload: {
      payload: Partial<typeof AgentStateAnnotation.State> | Command
      config: RunnableConfig<Configurable>
    } = {
      payload: { messages: messages },
      config,
    }

    const job = await langgraphQueue.add('process_query', jobPayload, { jobId: data.jobId })

    return {
      jobId: job.id,
      chat,
      chatMessages: [...newChatMessages, stepsMessage.data[0]],
      threadId: threadId,
    }
  }

  public async send(data: ChatSendDTO, user: IUser, externalSession?: ClientSession) {
    if (externalSession) {
      return this._executeSendTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeSendTransaction(data, user, session),
      )
    }
  }

  private async _updateStepperState(
    data: { chatId: string; threadId: string },
    user: IUser,
    externalSession?: ClientSession,
  ) {
    const chatMessages = await this.chatMessageService.getByCriteria(
      { chatId: data.chatId, threadId: data.threadId },
      user.id,
      externalSession,
    )

    const stepperMessage = [...chatMessages].reverse().find((msg) => msg.role === 'steps')

    if (!stepperMessage) return

    const steps = stepperMessage.content as {
      id: string
      name: string
      state: 'in_progress' | 'completed' | 'failed'
    }[]

    steps.forEach((step) => {
      if (step.state !== 'completed') {
        step.state = 'failed'
      }

      this.chatMessageService.edit(
        { content: steps },
        { id: stepperMessage.id.toString() },
        user,
        externalSession,
      )
    })
  }

  private async _deleteLastIteration(
    data: { chatId: string; threadId: string },
    user: IUser,
    externalSession?: ClientSession,
  ) {
    const chatMessages = await this.chatMessageService.getByCriteria(
      { chatId: data.chatId, threadId: data.threadId },
      user.id,
      externalSession,
    )

    const lastHumanMessage = [...chatMessages].reverse().find((msg) => msg.role === 'user')

    if (!lastHumanMessage) {
      throw new AppError('Не найдено сообщение для повторной попытки.', 400)
    }

    const messageIdsAfterLastHuman = chatMessages
      .filter((msg) => msg.createdAt > lastHumanMessage.createdAt)
      .map((msg) => msg.id.toString())

    await this.chatMessageService.delete({ ids: messageIdsAfterLastHuman }, user, externalSession)
  }

  private async _getLastStepperMessage(
    chatId: string,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<string | null> {
    const stepsMessage = await this.chatMessageService.getByCriteria(
      { chatId, role: 'steps' },
      user.id,
      externalSession,
      {
        sort: { createdAt: -1 },
        limit: 1,
      },
    )

    return stepsMessage.length > 0 ? stepsMessage[0].id.toHexString() : null
  }

  private async _executeRetryTransaction(
    data: RetryAgentDTO,
    user: IUser,
    externalSession?: ClientSession,
  ) {
    await this._deleteLastIteration(data, user, externalSession)
    const lastStepperMessageId = await this._getLastStepperMessage(
      data.chatId,
      user,
      externalSession,
    )

    const config = await this._getConfigurableFromUserSetting(user, {
      threadId: data.threadId,
      chatId: data.chatId.toString(),
      boardId: data.boardId,
      workspaceId: data.workspaceId,
      timezone: data.timezone,
      stepMessageId: lastStepperMessageId || '',
    })

    const jobPayload = {
      payload: { messages: [] },
      config,
      isRetry: true,
    }

    const job = await langgraphQueue.add('process_query', jobPayload, { jobId: data.jobId })

    return {
      jobId: job.id,
    }
  }

  public async retry(data: RetryAgentDTO, user: IUser, externalSession?: ClientSession) {
    if (externalSession) {
      return this._executeRetryTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeRetryTransaction(data, user, session),
      )
    }
  }

  private async _executeStopAgentTransaction(
    data: StopAgentDTO,
    user: IUser,
    externalSession?: ClientSession,
  ) {
    await this._updateStepperState(data, user, externalSession)

    const job = await langgraphQueue.getJob(data.jobId)

    if (!job) {
      throw new NotFoundError('Задача не найдена.')
    }

    await job.updateData({
      ...job.data,
      __abortSignal: true,
    })
  }

  public async stopAgent(data: StopAgentDTO, user: IUser, externalSession?: ClientSession) {
    if (externalSession) {
      return this._executeStopAgentTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeStopAgentTransaction(data, user, session),
      )
    }
  }

  private async _executeCreateTransaction(
    data: ChatDTO,
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IChat[]>> {
    const chat = await this.repository.create(
      {
        name: data.name,
        workspaceId: new Types.ObjectId(data.workspaceId),
        userId: user.id,
        threadId: data.threadId,
      },
      session,
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CHAT_HISTORIES,
        entitiesAfter: [chat],
        dependencies: [],
      },
      user.id,
      session,
    )

    return {
      data: [chat],
      logId: log.id,
    }
  }

  public async create(
    data: ChatDTO,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IChat[]>> {
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session),
      )
    }
  }

  private async _executeResolveAmbiguousTransaction(
    data: ResolveAmbiguousDTO,
    user: IUser,
    externalSession?: ClientSession,
  ) {
    const chatMessages = await this.chatMessageService.getByCriteria(
      { id: data.chatMessageId },
      user.id,
      externalSession,
    )

    if (!chatMessages || chatMessages.length === 0) {
      throw new AppError('Сообщение чата не найдено.', 400)
    }

    const chatMessage = chatMessages[0]

    await this.chatMessageService.delete(
      {
        id: data.chatMessageId,
      },
      user,
      externalSession,
    )

    const chatId = chatMessage.chatId.toString()

    const lastStepperMessageId = await this._getLastStepperMessage(chatId, user, externalSession)

    const config = await this._getConfigurableFromUserSetting(user, {
      threadId: chatMessage.threadId,
      chatId: chatId,
      boardId: data.boardId || '',
      workspaceId: data.workspaceId || '',
      timezone: data.timezone || 'UTC',
      stepMessageId: lastStepperMessageId || '',
    })

    await this.chatMessageService.delete(
      {
        id: data.chatMessageId,
      },
      user,
      externalSession,
    )

    const job = await langgraphQueue.add('resolve_ambiguous', {
      payload: new Command({
        resume: {
          ids: data.ids,
          callId: data.callId,
        },
      }),
      config,
    })

    return {
      jobId: job.id,
      chatMessage,
    }
  }

  private async _executeApproveLogTransaction(
    data: ApproveLogDTO,
    user: IUser,
    externalSession?: ClientSession,
  ) {
    const logs = await this.operationLogService.getByCriteria(
      { id: data.id },
      user.id,
      externalSession,
    )

    if (!logs || logs.length === 0) {
      throw new AppError('Лог не найден.', 400)
    }

    const log = logs[0]

    await this.operationLogService.edit(
      {
        status: data.isConfirmed
          ? OperationLogStatusesEnum.APPROVED
          : OperationLogStatusesEnum.CANCELLED,
        selectedIds: data.selectedIds,
      },
      {
        id: log.id.toString(),
      },
      user.id,
      externalSession,
    )

    const lastStepperMessageId = await this._getLastStepperMessage(
      data.chatId,
      user,
      externalSession,
    )

    const config = await this._getConfigurableFromUserSetting(user, {
      threadId: data.threadId,
      chatId: data.chatId,
      boardId: data.boardId || '',
      workspaceId: data.workspaceId || '',
      timezone: data.timezone || 'UTC',
      stepMessageId: lastStepperMessageId || '',
    })

    const job = await langgraphQueue.add('review', {
      payload: new Command({
        resume: {},
      }),

      config,
    })

    return {
      jobId: job.id,
    }
  }

  public async approveLog(data: ApproveLogDTO, user: IUser, externalSession?: ClientSession) {
    if (externalSession) {
      return this._executeApproveLogTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeApproveLogTransaction(data, user, session),
      )
    }
  }

  public async resolveAmbiguous(
    data: ResolveAmbiguousDTO,
    user: IUser,
    externalSession?: ClientSession,
  ) {
    if (externalSession) {
      return this._executeResolveAmbiguousTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeResolveAmbiguousTransaction(data, user, session),
      )
    }
  }
}
