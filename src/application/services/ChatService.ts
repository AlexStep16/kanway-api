import ChatRepository from '@repositories/ChatRepository.js'
import { ChatDTO } from '@dtos/ChatDTO.js'
import { IUser } from '@/domain/entities/IUser.js'
import { OperationLogService } from './OperationLogService.js'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.js'
import { CollectionsEnum } from '@/domain/enums/CollectionsEnum.js'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'
import { IChat } from '@domain/entities/IChat.js'
import { IChatCriteria } from '@interfaces/criterias/IChatCriteria.js'
import { ChatSendDTO } from '@dtos/ChatSendDTO.js'
import { ChatMessageService } from '@application/services/ChatMessageService.js'
import { RunnableConfig } from '@langchain/core/runnables'
import dayjs from 'dayjs'
import { langgraphQueue } from '@/infrastructure/queues/index.js'
import { ApproveToolDTO } from '@dtos/ApproveToolDTO.js'
import { SettingService } from '@application/services/SettingService.js'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { RetryAgentDTO } from '@dtos/RetryAgentDTO.js'
import { StopAgentDTO } from '@dtos/StopAgentDTO.js'
import { NotFoundError } from '@errors/NotFound.js'
import { AppError } from '@errors/AppError.js'
import { BaseService } from '@application/services/BaseService.js'
import { IChatRaw } from '@entities/IChatRaw.js'
import { BoardService } from './BoardService.js'
import { WorkspaceService } from './WorkspaceService.js'
import { TaskService } from './TaskService.js'
import { CategoryService } from './CategoryService.js'
import CheckpointWriteRepository from '../repositories/CheckpointWriteRepository.js'
import CheckpointRepository from '../repositories/CheckpointRepository.js'
import { ChatEditDTO } from '../dtos/ChatEditDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'
import { UserService } from './UserService.js'
import { IStatus } from '../interfaces/statuses/IStatus.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { IChatMessage } from '@/domain/entities/IChatMessage.js'
import { AgentWorkerDTO } from '../dtos/AgentWorkerDTO.js'
import { ToolReviewResumePayload } from '../ai/agent/types/ToolReviewResumePayload.js'

const MAX_RETRIES = 3

type ActiveEntity = {
  id: string
  name: string
}

type SendThreadContext = {
  chat: IChat
  threadId: string
  board: ActiveEntity | null
  workspace: ActiveEntity
  isChatNameNeeded: boolean
  chargedAudioTokens: number
  chatMessages: IChatMessage[]
}

export class ChatService extends BaseService<IChatRaw, IChat, IChatCriteria> {
  protected repository: ChatRepository
  protected userService: UserService
  protected operationLogService: OperationLogService
  protected chatMessageService: ChatMessageService
  protected settingService: SettingService
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService
  protected checkpointWriteRepository: CheckpointWriteRepository
  protected checkpointRepository: CheckpointRepository

  constructor(
    chatRepository: ChatRepository,
    userService: UserService,
    operationLogService: OperationLogService,
    chatMessageService: ChatMessageService,
    settingService: SettingService,
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
    checkpointWriteRepository: CheckpointWriteRepository,
    checkpointRepository: CheckpointRepository,
  ) {
    super(chatRepository)

    this.repository = chatRepository
    this.userService = userService
    this.operationLogService = operationLogService
    this.chatMessageService = chatMessageService
    this.settingService = settingService
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
    this.workspaceService = workspaceService
    this.checkpointWriteRepository = checkpointWriteRepository
    this.checkpointRepository = checkpointRepository
  }

  private async _getActiveEntities(
    boardId: string | undefined,
    workspaceId: string,
    user: IUser,
    session?: ClientSession,
  ) {
    const boards = boardId
      ? await this.boardService.getByCriteria({ id: boardId }, user.id, session)
      : null

    const workspaces = await this.workspaceService.getByCriteria(
      { id: workspaceId },
      user.id,
      session,
    )

    const board = boards
      ? {
          id: boards[0].id.toString(),
          name: boards[0].name,
        }
      : null
    const workspace = {
      id: workspaces[0].id.toString(),
      name: workspaces[0].name,
    }

    return { board, workspace }
  }

  private async _getConfigurableFromUserSetting(
    user: IUser,
    data: {
      threadId: string
      chatId: string
      modelType: ModelsEnum
      timezone: string
      isChatNameNeeded?: boolean
      userMessage: string
      chargedAudioTokens?: number
      statusMessageId: string
      activeBoard: { id: string; name: string } | null
      activeWorkspace: { id: string; name: string }
    },
    session?: ClientSession,
  ): Promise<RunnableConfig<Configurable>> {
    const userSettings = await this.settingService.getByCriteria({}, user.id, session)
    const userSetting = userSettings[0]

    const categories = await this.categoryService.getByCriteria(
      { boardId: data.activeBoard?.id, isDeleted: false, isDeletedExternal: false },
      user.id,
      session,
    )
    const categoriesList = categories
      .map((category) => `${category.name} (${category.id})`)
      .join(', ')

    const tasks = await this.taskService.getByCriteria(
      { boardId: data.activeBoard?.id, isDeleted: false, isDeletedExternal: false },
      user.id,
      session,
    )
    const tagsSet = new Set<string>()
    tasks.forEach((task) => {
      task.tags.forEach((tag) => tagsSet.add(tag))
    })
    const tagsList = Array.from(tagsSet).join(', ')
    const modelType =
      user.subscriptionId === SubscriptionPlanEnum.Basic ? ModelsEnum.KANWAY_LITE : data.modelType

    const config: RunnableConfig<Configurable> = {
      recursionLimit: 30,
      configurable: {
        thread_id: data.threadId,
        user,
        chatId: data.chatId,
        activeBoard: data.activeBoard,
        modelType,
        activeWorkspace: data.activeWorkspace,
        currentDate: dayjs.tz(dayjs(), data.timezone).toISOString(),
        categoriesList: categoriesList.length > 0 ? categoriesList : 'No categories',
        tagsList: tagsList.length > 0 ? tagsList : 'No tags',
        timezone: data.timezone,
        isChatNameNeeded: !!data.isChatNameNeeded,
        userMessage: data.userMessage,
        chargedAudioTokens: data.chargedAudioTokens,

        aiName: userSetting.aiName || 'Kanway',
        aiConfirmationType: userSetting.aiConfirmationType,
        defaultCategoryName: userSetting.aiDefaultCategory,
        defaultBoardName: userSetting.aiDefaultBoard,
        statusMessageId: data.statusMessageId,
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

  private async _createThreadJobPayload(
    user: IUser,
    data: {
      threadId: string
      chatId: string
      modelType: ModelsEnum
      timezone: string
      isChatNameNeeded?: boolean
      userMessage: string
      chargedAudioTokens?: number
      activeBoard: { id: string; name: string } | null
      activeWorkspace: { id: string; name: string }
    },
    externalSession: ClientSession,
  ) {
    const statusContent: IStatus = {
      statusText: '',
      currentAgent: AgentsEnum.ORCHESTRATOR,
      state: StatusStatesEnum.IN_PROGRESS,
      logs: [],
    }

    const statusMessages = await this.chatMessageService.create(
      {
        role: 'status',
        content: statusContent,
        threadId: data.threadId,
        chatId: new Types.ObjectId(data.chatId),
      },
      user,
      externalSession,
    )

    const statusMessage = statusMessages.data[0]

    const config = await this._getConfigurableFromUserSetting(
      user,
      {
        threadId: data.threadId,
        chatId: data.chatId,
        modelType: data.modelType,
        timezone: data.timezone,
        statusMessageId: statusMessage.id.toHexString(),
        isChatNameNeeded: data.isChatNameNeeded,
        activeBoard: data.activeBoard,
        chargedAudioTokens: data.chargedAudioTokens,
        activeWorkspace: data.activeWorkspace,
        userMessage: data.userMessage,
      },
      externalSession,
    )

    const jobPayload: AgentWorkerDTO = {
      payload: {},
      config,
    }

    return { jobPayload, statusMessage }
  }

  private async _continueThread(
    data: ChatSendDTO,
    user: IUser,
    externalSession: ClientSession,
    context: SendThreadContext,
  ) {
    const lastConversationMessage = [...context.chatMessages]
      .reverse()
      .find((message) => message.role !== 'status')

    if (!lastConversationMessage || lastConversationMessage.role !== 'user') {
      throw new AppError('Нельзя продолжить без последнего сообщения пользователя.', 400)
    }

    const { jobPayload, statusMessage } = await this._createThreadJobPayload(
      user,
      {
        threadId: context.threadId,
        chatId: context.chat.id.toString(),
        modelType: data.modelType || ModelsEnum.KANWAY_LITE,
        timezone: data.timezone,
        isChatNameNeeded: context.isChatNameNeeded,
        userMessage: lastConversationMessage.content as string,
        chargedAudioTokens: context.chargedAudioTokens,
        activeBoard: context.board,
        activeWorkspace: context.workspace,
      },
      externalSession,
    )

    return {
      jobPayload,
      userMessage: lastConversationMessage,
      statusMessage,
      chat: context.chat,
      threadId: context.threadId,
    }
  }

  private async _sendWithMessage(
    data: ChatSendDTO,
    user: IUser,
    externalSession: ClientSession,
    context: SendThreadContext,
  ) {
    const createUserMessageResult = await this.chatMessageService.create(
      {
        role: 'user',
        content: data.message,
        chatId: context.chat.id,
        threadId: context.threadId,
      },
      user,
      externalSession,
    )

    const userMessage = createUserMessageResult.data[0]

    const { jobPayload, statusMessage } = await this._createThreadJobPayload(
      user,
      {
        threadId: context.threadId,
        chatId: context.chat.id.toString(),
        modelType: data.modelType || ModelsEnum.KANWAY_LITE,
        timezone: data.timezone,
        isChatNameNeeded: context.isChatNameNeeded,
        userMessage: data.message!,
        chargedAudioTokens: context.chargedAudioTokens,
        activeBoard: context.board,
        activeWorkspace: context.workspace,
      },
      externalSession,
    )

    return {
      jobPayload,
      userMessage,
      statusMessage,
      chat: context.chat,
      threadId: context.threadId,
    }
  }

  public async send(data: ChatSendDTO, user: IUser, externalSession: ClientSession) {
    let chat: IChat | null = null
    let toolsWithNoDecision = 0
    let isChatNameNeeded = false
    let chargedAudioTokens = 0

    const threadId = data.threadId || new Types.ObjectId().toString()

    if (user.credits <= 0 && user.paidCredits <= 0) {
      throw new AppError(ErrorMessages.CREDITS_LOW, 403)
    }

    if (
      data.modelType === ModelsEnum.KANWAY_PRO &&
      user.subscriptionId === SubscriptionPlanEnum.Basic
    ) {
      throw new AppError(
        'Модель Kanway Pro доступна только для пользователей с платной подпиской.',
        403,
      )
    }

    if (user.audioTokensUsed >= 2500) {
      chargedAudioTokens = await this.userService.chargeAudioUsage(
        user.audioTokensUsed,
        user,
        externalSession,
      )
    }

    const { board, workspace } = await this._getActiveEntities(
      data.boardId,
      data.workspaceId,
      user,
      externalSession,
    )

    if (!data.threadId) {
      isChatNameNeeded = true

      const createResult = await this.create(
        {
          name: 'Новый чат',
          workspaceId: data.workspaceId,
          threadId,
        },
        user,
        externalSession,
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

    const lastStatusMessage = [...chatMessages].reverse().find((msg) => msg.role === 'status')

    if (lastStatusMessage) {
      const logs = (lastStatusMessage.content as IStatus).logs
      for (const log of logs) {
        if (log.state === StatusStatesEnum.AWAITING_CONFIRMATION) {
          toolsWithNoDecision++
        }
      }
    }

    if (toolsWithNoDecision > 0) {
      throw new AppError('Не все действия подтверждены или отменены.', 400)
    }

    const context: SendThreadContext = {
      chat,
      threadId,
      board,
      workspace,
      isChatNameNeeded,
      chargedAudioTokens,
      chatMessages,
    }

    if (data.message) {
      return await this._sendWithMessage(data, user, externalSession, context)
    }

    if (!data.threadId) {
      throw new AppError('Для нового чата требуется сообщение пользователя.', 400)
    }

    return await this._continueThread(data, user, externalSession, context)
  }

  public async edit(data: ChatEditDTO, criteria: IChatCriteria, user: IUser): Promise<IChat[]> {
    await this.repository.updateManyByCriteria(criteria, data, undefined, user.id)

    return await this.getByCriteria(criteria, user.id)
  }

  private async _deleteLastIteration(
    lastStepperMessageId: string,
    data: { chatId: string; threadId: string },
    user: IUser,
    externalSession?: ClientSession,
  ) {
    const lastStepperMessages = await this.chatMessageService.getByCriteria(
      { id: lastStepperMessageId },
      user.id,
      externalSession,
    )

    const lastStepperMessage = lastStepperMessages[0]

    if (!lastStepperMessage) {
      throw new AppError('Не найдено сообщение для повторной попытки.', 400)
    }

    await this.chatMessageService.delete(
      {
        chatId: data.chatId,
        createdAt: {
          $gt: lastStepperMessage.createdAt,
        },
      },
      user,
      externalSession,
    )
  }

  private async _executeRetryTransaction(
    data: RetryAgentDTO,
    user: IUser,
    externalSession: ClientSession,
  ) {
    const chatMessages = await this.chatMessageService.getByCriteria(
      { chatId: data.chatId },
      user.id,
      externalSession,
      undefined,
      {
        sort: { createdAt: -1 },
      },
    )

    const { board, workspace } = await this._getActiveEntities(
      data.boardId,
      data.workspaceId,
      user,
      externalSession,
    )

    const lastUserMessage = chatMessages.find((msg) => msg.role === 'user')

    if (!lastUserMessage) {
      throw new AppError('Не найдено сообщение пользователя для повторной попытки.', 400)
    }

    const lastStatusMessage = chatMessages.find((msg) => msg.role === 'status')

    if (!lastStatusMessage) {
      throw new AppError('Не найдено сообщение статуса для повторной попытки.', 400)
    }

    const lastStatusMessageId = lastStatusMessage ? lastStatusMessage.id.toHexString() : null

    if (lastStatusMessageId) {
      await this._deleteLastIteration(lastStatusMessageId, data, user, externalSession)
    }

    const config = await this._getConfigurableFromUserSetting(
      user,
      {
        threadId: data.threadId,
        chatId: data.chatId.toString(),
        timezone: data.timezone,
        activeBoard: board,
        activeWorkspace: workspace,
        statusMessageId: lastStatusMessageId || '',
        userMessage: lastUserMessage ? lastUserMessage.content : '',
        modelType: data.modelType || ModelsEnum.KANWAY_LITE,
      },
      externalSession,
    )

    const jobPayload: AgentWorkerDTO = {
      payload: {},
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

  private async _executeStopAgentTransaction(data: StopAgentDTO) {
    const job = await langgraphQueue.getJob(data.jobId)

    if (!job) {
      throw new NotFoundError('Задача не найдена.')
    }

    await job.updateData({
      ...job.data,
      __abortSignal: true,
    })
  }

  public async stopAgent(data: StopAgentDTO) {
    await this._executeStopAgentTransaction(data)
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

  private async _executeDeleteTransaction(
    criteria: IChatCriteria,
    user: IUser,
    session: ClientSession,
  ) {
    const chats = await this.repository.findByCriteria(criteria, session, undefined, user.id)
    const uniqueChatIds = Array.from(new Set(chats.map((chat) => chat.id.toString())))
    const uniqueThreadIds = Array.from(new Set(chats.map((chat) => chat.threadId.toString())))

    const promises = []

    promises.push(
      this.chatMessageService.delete(
        {
          chatIds: uniqueChatIds,
        },
        user,
        session,
      ),
    )

    promises.push(
      this.checkpointWriteRepository.deleteMany({
        threadIds: uniqueThreadIds,
      }),
    )

    promises.push(
      this.checkpointRepository.deleteMany({
        threadIds: uniqueThreadIds,
      }),
    )

    await Promise.all(promises)

    await this.repository.deleteMany(criteria, user.id, session)
  }

  public async delete(
    criteria: IChatCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<void> {
    if (externalSession) {
      return this._executeDeleteTransaction(criteria, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, user, session),
      )
    }
  }

  private async _executeApproveToolTransaction(
    data: ApproveToolDTO,
    user: IUser,
    externalSession: ClientSession,
  ) {
    const { board, workspace } = await this._getActiveEntities(
      data.boardId,
      data.workspaceId,
      user,
      externalSession,
    )

    const chatMessages = await this.chatMessageService.getByCriteria(
      { chatId: data.chatId },
      user.id,
      externalSession,
      undefined,
      {
        sort: { createdAt: -1 },
      },
    )

    const lastUserMessage = chatMessages.find((msg) => msg.role === 'user')

    if (!lastUserMessage) {
      throw new AppError('Не найдено сообщение пользователя для повторной попытки.', 400)
    }

    const lastStatusMessage = chatMessages.find((msg) => msg.role === 'status')

    if (!lastStatusMessage) {
      throw new AppError('Не найдено сообщение статуса для повторной попытки.', 400)
    }

    const statusLog = (lastStatusMessage.content as IStatus).logs.find(
      (log) => log.id === data.statusLogId,
    )

    const config = await this._getConfigurableFromUserSetting(
      user,
      {
        threadId: data.threadId,
        chatId: data.chatId,
        activeBoard: board,
        activeWorkspace: workspace,
        timezone: data.timezone || 'UTC',
        statusMessageId: lastStatusMessage ? lastStatusMessage.id.toHexString() : '',
        userMessage: lastUserMessage ? lastUserMessage.content : '',
        modelType: data.modelType || ModelsEnum.KANWAY_LITE,
      },
      externalSession,
    )

    const payload: ToolReviewResumePayload = {
      toolId: data.toolId,
      isConfirmed: data.isConfirmed,
      isRejected: data.isRejected,
      statusLog,
    }

    const jobPayload: AgentWorkerDTO = {
      payload,
      config,
      isResume: true,
    }

    const job = await langgraphQueue.add('process_query', jobPayload, { jobId: data.jobId })

    return {
      jobId: job.id,
    }
  }

  public async approveTool(data: ApproveToolDTO, user: IUser, externalSession?: ClientSession) {
    if (externalSession) {
      return this._executeApproveToolTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeApproveToolTransaction(data, user, session),
      )
    }
  }
}
