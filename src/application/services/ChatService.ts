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
import { ChatMessageService } from '@application/services/ChatMessageService.ts'
import { RunnableConfig } from '@langchain/core/runnables'
import dayjs from 'dayjs'
import { langgraphQueue } from '@/infrastructure/queues/index.ts'
import { ApproveLogDTO } from '@dtos/ApproveLogDTO.ts'
import { Command } from '@langchain/langgraph'
import { SettingService } from '@application/services/SettingService.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { RetryAgentDTO } from '@dtos/RetryAgentDTO.ts'
import { StopAgentDTO } from '@dtos/StopAgentDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { AppError } from '@errors/AppError.ts'
import { BaseService } from '@application/services/BaseService.ts'
import { IChatRaw } from '@entities/IChatRaw.ts'
import { BoardService } from './BoardService.ts'
import { WorkspaceService } from './WorkspaceService.ts'
import { AgentStateAnnotation } from '../ai/agent/AgentStateAnnotation.ts'
import { ResolveAmbiguousDTO } from '../dtos/ResolveAmbiguousDTO.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { getDefaultState } from '../ai/helpers/getDefaultState.ts'
import { TaskService } from './TaskService.ts'
import { CategoryService } from './CategoryService.ts'
import CheckpointWriteRepository from '../repositories/CheckpointWriteRepository.ts'
import CheckpointRepository from '../repositories/CheckpointRepository.ts'
import { ChatEditDTO } from '../dtos/ChatEditDTO.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'

const MAX_RETRIES = 3

export class ChatService extends BaseService<IChatRaw, IChat, IChatCriteria> {
  protected repository: ChatRepository
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
    workspaceId: string | undefined,
    user: IUser,
    session?: ClientSession,
  ) {
    let activeBoardName = ''
    let activeWorkspaceName = ''

    const activeBoard = boardId
      ? await this.boardService.getByCriteria({ id: boardId }, user.id, session)
      : null

    const activeWorkspace = workspaceId
      ? await this.workspaceService.getByCriteria({ id: workspaceId }, user.id, session)
      : null

    if (activeBoard && activeBoard.length > 0) {
      activeBoardName = activeBoard[0].name
    }

    if (activeWorkspace && activeWorkspace.length > 0) {
      activeWorkspaceName = activeWorkspace[0].name
    }

    return { activeBoardName, activeWorkspaceName }
  }

  private async _getConfigurableFromUserSetting(
    user: IUser,
    data: {
      threadId: string
      chatId: string
      boardId?: string
      workspaceId: string
      timezone: string
      isChatNameNeeded?: boolean
      userMessage: string
      stepMessageId: string
      activeBoardName?: string
      activeWorkspaceName?: string
    },
    session?: ClientSession,
  ): Promise<RunnableConfig<Configurable>> {
    const userSettings = await this.settingService.getByCriteria({}, user.id, session)
    const userSetting = userSettings[0]

    const categories = await this.categoryService.getByCriteria(
      { boardId: data.boardId, isDeleted: false, isDeletedExternal: false },
      user.id,
      session,
    )
    const categoriesList = categories
      .map((category) => `${category.name} (${category.id})`)
      .join(', ')

    const tasks = await this.taskService.getByCriteria(
      { boardId: data.boardId, isDeleted: false, isDeletedExternal: false },
      user.id,
      session,
    )
    const tagsSet = new Set<string>()
    tasks.forEach((task) => {
      task.tags.forEach((tag) => tagsSet.add(tag))
    })
    const tagsList = Array.from(tagsSet).join(', ')

    const config: RunnableConfig<Configurable> = {
      recursionLimit: 60,
      configurable: {
        thread_id: data.threadId,
        user,
        chatId: data.chatId,
        activeBoardId: data.boardId,
        activeBoardName: data.activeBoardName,
        activeWorkspaceId: data.workspaceId,
        activeWorkspaceName: data.activeWorkspaceName,
        currentDate: dayjs.tz(dayjs(), data.timezone).toISOString(),
        categoriesList: categoriesList.length > 0 ? categoriesList : 'No categories',
        tagsList: tagsList.length > 0 ? tagsList : 'No tags',
        timezone: data.timezone,
        isChatNameNeeded: !!data.isChatNameNeeded,
        userMessage: data.userMessage,

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

  public async send(data: ChatSendDTO, user: IUser, externalSession: ClientSession) {
    let chat: IChat | null = null
    let toolsWithNoDecision = 0
    let isChatNameNeeded = false

    const messages: BaseMessage[] = []
    const threadId = data.threadId || new Types.ObjectId().toString()

    if (user.credits === 0) {
      throw new AppError(ErrorMessages.CREDITS_LOW, 403)
    }

    const { activeBoardName, activeWorkspaceName } = await this._getActiveEntities(
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

    if (
      !data.message &&
      chatMessages.length > 0 &&
      chatMessages[chatMessages.length - 1].role !== 'user'
    ) {
      throw new AppError('Последнее сообщение в чате не является сообщением от пользователя.', 400)
    }

    const createUserMessageResult = await this.chatMessageService.create(
      {
        role: 'user',
        content: data.message,
        chatId: chat.id,
        threadId,
      },
      user,
      externalSession,
    )

    const userMessage = createUserMessageResult.data[0]

    messages.push(new HumanMessage(data.message!))

    const stepMessages = await this.chatMessageService.create(
      {
        role: 'steps',
        content: [
          {
            id: new Types.ObjectId().toHexString(),
            name: 'Устанавливаю соединение с AI',
            state: 'in_progress',
          },
        ],
        threadId: threadId,
        chatId: chat.id,
      },
      user,
      externalSession,
    )

    const stepMessage = stepMessages.data[0]

    const config = await this._getConfigurableFromUserSetting(
      user,
      {
        threadId: threadId,
        chatId: chat.id.toString(),
        boardId: data.boardId,
        workspaceId: data.workspaceId,
        timezone: data.timezone,
        stepMessageId: stepMessage.id.toHexString(),
        isChatNameNeeded,
        activeBoardName,
        activeWorkspaceName,
        userMessage: data.message || '',
      },
      externalSession,
    )

    const payload = getDefaultState()

    payload.messages = messages

    const jobPayload: {
      payload: Partial<typeof AgentStateAnnotation.State> | Command
      config: RunnableConfig<Configurable>
    } = {
      payload,
      config,
    }

    return {
      jobPayload,
      userMessage,
      stepMessage,
      chat,
      threadId: threadId,
    }
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

    const lastUserMessage = chatMessages.find((msg) => msg.role === 'user')

    if (!lastUserMessage) {
      throw new AppError('Не найдено сообщение пользователя для повторной попытки.', 400)
    }

    const lastStepperMessage = chatMessages.find((msg) => msg.role === 'steps')

    if (!lastStepperMessage) {
      throw new AppError('Не найдено сообщение шагов для повторной попытки.', 400)
    }

    const lastStepperMessageId = lastStepperMessage ? lastStepperMessage.id.toHexString() : null

    if (lastStepperMessageId) {
      await this._deleteLastIteration(lastStepperMessageId, data, user, externalSession)
    }

    const config = await this._getConfigurableFromUserSetting(
      user,
      {
        threadId: data.threadId,
        chatId: data.chatId.toString(),
        boardId: data.boardId,
        workspaceId: data.workspaceId,
        timezone: data.timezone,
        stepMessageId: lastStepperMessageId || '',
        userMessage: lastUserMessage ? lastUserMessage.content : '',
      },
      externalSession,
    )

    const payload = getDefaultState()

    const jobPayload = {
      payload,
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

  private async _executeResolveAmbiguousTransaction(
    data: ResolveAmbiguousDTO,
    user: IUser,
    externalSession: ClientSession,
  ) {
    const chatMessages = await this.chatMessageService.getByCriteria(
      { id: data.chatMessageId },
      user.id,
      externalSession,
      undefined,
      {
        sort: { createdAt: -1 },
      },
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

    const lastUserMessage = chatMessages.find((msg) => msg.role === 'user')

    if (!lastUserMessage) {
      throw new AppError('Не найдено сообщение пользователя для повторной попытки.', 400)
    }

    const lastStepperMessage = chatMessages.find((msg) => msg.role === 'steps')

    if (!lastStepperMessage) {
      throw new AppError('Не найдено сообщение шагов для повторной попытки.', 400)
    }

    const config = await this._getConfigurableFromUserSetting(
      user,
      {
        threadId: chatMessage.threadId,
        chatId: chatId,
        boardId: data.boardId || '',
        workspaceId: data.workspaceId || '',
        timezone: data.timezone || 'UTC',
        stepMessageId: lastStepperMessage ? lastStepperMessage.id.toHexString() : '',
        userMessage: lastUserMessage ? lastUserMessage.content : '',
      },
      externalSession,
    )

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
    externalSession: ClientSession,
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

    const chatMessages = await this.chatMessageService.getByCriteria(
      { chatId: data.chatId },
      user.id,
      externalSession,
      undefined,
      {
        sort: { createdAt: -1 },
      },
    )

    let toolsWithNoDecision = 0

    for (const chatMessage of chatMessages) {
      if (chatMessage.role === 'operation') {
        const logId: string = chatMessage.content

        if (!logId) continue

        const logs = await this.operationLogService.getByCriteria(
          {
            id: logId,
          },
          user.id,
        )

        if (logs && logs.length > 0) {
          const log = logs[0]

          if (log.status === OperationLogStatusesEnum.PENDING) {
            toolsWithNoDecision += 1
          }
        }
      }
    }

    if (toolsWithNoDecision > 0) return

    const lastUserMessage = chatMessages.find((msg) => msg.role === 'user')

    if (!lastUserMessage) {
      throw new AppError('Не найдено сообщение пользователя для повторной попытки.', 400)
    }

    const lastStepperMessage = chatMessages.find((msg) => msg.role === 'steps')

    if (!lastStepperMessage) {
      throw new AppError('Не найдено сообщение шагов для повторной попытки.', 400)
    }

    const config = await this._getConfigurableFromUserSetting(
      user,
      {
        threadId: data.threadId,
        chatId: data.chatId,
        boardId: data.boardId || '',
        workspaceId: data.workspaceId || '',
        timezone: data.timezone || 'UTC',
        stepMessageId: lastStepperMessage ? lastStepperMessage.id.toHexString() : '',
        userMessage: lastUserMessage ? lastUserMessage.content : '',
      },
      externalSession,
    )

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
