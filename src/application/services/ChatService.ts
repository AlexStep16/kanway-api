import ChatRepository from '@repositories/ChatRepository.ts'
import { ICreateService } from '../interfaces/traits/ICreateService.ts'
import { ChatDTO } from '@dtos/ChatDTO.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { OperationLogService } from './OperationLogService.ts'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@/domain/enums/CollectionsEnum.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IChat } from '@domain/entities/IChat.ts'
import { toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { ChatCriteria } from '@interfaces/criterias/ChatCriteria.ts'
import { ChatSendDTO } from '@dtos/ChatSendDTO.ts'
import { BaseMessage, HumanMessage } from '@langchain/core/messages'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.ts'
import { ChatMessageService } from '@application/services/ChatMessageService.ts'
import { RunnableConfig } from '@langchain/core/runnables'
import dayjs from 'dayjs'
import { langgraphQueue } from '@/infrastructure/queues/index.ts'
import { ApproveToolCallDTO } from '@dtos/ApproveToolCallDTO.ts'
import { Command } from '@langchain/langgraph'
import { ChatMessageContent } from '@/application/ai/interfaces/ChatMessageContent.ts'
import { SettingService } from './SettingService.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'
import { Configurable } from '../ai/interfaces/Configurable.ts'
import { RetryAgentDTO } from '../dtos/RetryAgentDTO.ts'

const MAX_RETRIES = 3

export class ChatService implements ICreateService<IChat, ChatDTO> {
  protected repository: ChatRepository
  protected operationLogService: OperationLogService
  protected chatMessageService: ChatMessageService
  protected settingService: SettingService
  protected contextExternalFetchService: ContextExternalFetchService

  constructor(
    ChatRepository: ChatRepository,
    operationLogService: OperationLogService,
    chatMessageService: ChatMessageService,
    settingService: SettingService,
    contextExternalFetchService: ContextExternalFetchService
  ) {
    this.repository = ChatRepository
    this.operationLogService = operationLogService
    this.chatMessageService = chatMessageService
    this.settingService = settingService
    this.contextExternalFetchService = contextExternalFetchService
  }

  private async _getConfigurableFromUserSetting(
    user: IUser,
    data: {
      threadId: string
      chatId: string
      boardId: string
      workspaceId: string
      timezone: string
    }
  ): Promise<RunnableConfig<Configurable>> {
    const userSetting = await this.settingService.getByUserId(user.id)

    const config: RunnableConfig<Configurable> = {
      recursionLimit: 25,
      configurable: {
        thread_id: data.threadId,
        user,
        chatId: data.chatId,
        activeBoardId: data.boardId,
        activeWorkspaceId: data.workspaceId,
        currentDate: dayjs.tz(dayjs(), data.timezone).toISOString(),
        timezone: data.timezone,

        aiName: userSetting.aiName || 'Kanbar',
        aiConfirmationType: userSetting.aiConfirmationType,
        defaultCategoryName: userSetting.aiDefaultCategory,
        defaultBoardName: userSetting.aiDefaultBoard,
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
    throw new Error(
      'Произошла ошибка при выполнении операции после максимального количества попыток.'
    )
  }

  public async send(data: ChatSendDTO, user: IUser) {
    let messages: BaseMessage[] = []
    let chat: IChat | null = null
    const threadId = data.threadId || new Types.ObjectId().toString()

    if (user.subscriptionId === SubscriptionPlanEnum.Basic && user.generationsCount === 0) {
      return
    }

    try {
      if (!data.message) {
        return
      }

      messages = [new HumanMessage(data.message)]

      if (!data.threadId) {
        const createResult = await this.create(
          {
            name: data.message.slice(0, 500),
            workspaceId: data.workspaceId,
            threadId: threadId,
          },
          user
        )

        chat = createResult.data[0]
      } else {
        const createChatResult = await this.getAll({ threadId: data.threadId }, user.id)

        chat = createChatResult[0]
      }

      const userMessage = await this.chatMessageService.create(
        {
          role: 'user',
          content: data.message,
          chatId: chat.id,
          threadId,
        },
        user
      )

      const config = await this._getConfigurableFromUserSetting(user, {
        threadId: threadId,
        chatId: chat.id.toString(),
        boardId: data.boardId,
        workspaceId: data.workspaceId,
        timezone: data.timezone,
      })

      const jobPayload = { payload: messages, config }

      const job = await langgraphQueue.add('process_query', jobPayload)

      return {
        jobId: job.id,
        chat,
        chatMessages: [userMessage.data[0]],
        threadId: threadId,
      }
    } catch (error) {
      throw error
    }
  }

  public async retry(data: RetryAgentDTO, user: IUser, externalSession?: ClientSession) {
    const chatMessages = await this.chatMessageService.getAll(
      { chatId: data.chatId, threadId: data.threadId },
      user.id
    )

    const lastHumanMessage = [...chatMessages].reverse().find((msg) => msg.role === 'user')

    if (!lastHumanMessage) {
      throw new Error('Не найдено сообщение для повторной попытки.')
    }

    const messageIdsAfterLastHuman = chatMessages
      .filter((msg) => msg.createdAt > lastHumanMessage.createdAt)
      .map((msg) => msg.id.toString())

    await this.chatMessageService.delete({ ids: messageIdsAfterLastHuman }, user, externalSession)

    const config = await this._getConfigurableFromUserSetting(user, {
      threadId: data.threadId,
      chatId: data.chatId.toString(),
      boardId: data.boardId,
      workspaceId: data.workspaceId,
      timezone: data.timezone,
    })

    const jobPayload = { payload: [], config, isRetry: true }

    const job = await langgraphQueue.add('process_query', jobPayload)

    return {
      jobId: job.id,
    }
  }

  private async _executeCreateTransaction(
    data: ChatDTO,
    user: IUser,
    session: ClientSession
  ): Promise<IResponseWithLog<IChat[]>> {
    const Chat = await this.repository.create(
      {
        name: data.name,
        workspace_id: Types.ObjectId.createFromHexString(data.workspaceId),
        user_id: user.id,
        thread_id: data.threadId,
      },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CHAT_HISTORIES,
        entitiesAfter: [Chat],
        dependencies: [],
      },
      user.id,
      session
    )

    return {
      data: [toServerCaseKeys<IChat>(Chat)],
      logId: log[0].id,
    }
  }

  public async create(
    data: ChatDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IChat[]>> {
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session)
      )
    }
  }

  public async approveToolCall(
    data: ApproveToolCallDTO,
    user: IUser,
    externalSession?: ClientSession
  ) {
    const chatMessage = await this.chatMessageService.getById(
      data.chatMessageId,
      user.id,
      externalSession
    )
    let toolsWithNoDecision = 0

    if (!chatMessage) {
      throw new Error('Сообщение чата не найдено.')
    }

    const content: Array<ChatMessageContent> = chatMessage.content

    if (!content) throw new Error('Содержимое сообщения отсутствует.')

    const updatedContent = content.map((item) => {
      if (item.callId === data.toolCallId) {
        return {
          ...item,
          isConfirmed: true,
        }
      }

      if (!item.isConfirmed && !item.isCancelled) {
        toolsWithNoDecision += 1
      }

      return item
    })

    await this.chatMessageService.edit(
      {
        content: updatedContent,
      },
      {
        id: data.chatMessageId,
      },
      user,
      externalSession
    )

    const userSetting = await this.settingService.getByUserId(user.id)

    if (toolsWithNoDecision === 0) {
      const config: RunnableConfig<Configurable> = {
        recursionLimit: 20,
        configurable: {
          thread_id: chatMessage.threadId,
          user,
          chatId: chatMessage.chatId.toString(),
          activeBoardId: data.boardId,
          activeWorkspaceId: data.workspaceId,
          currentDate: dayjs.tz(dayjs(), data.timezone).toISOString(),
          timezone: data.timezone,

          aiConfirmationType: userSetting.aiConfirmationType,
          aiName: userSetting.aiName || 'Kanbar',
          defaultCategoryName: userSetting.aiDefaultCategory,
          defaultBoardName: userSetting.aiDefaultBoard,
        },
      }

      const toolsConfirmed = updatedContent
        .filter((item) => item.isConfirmed === true)
        .map((item) => item.callId)
      const toolsCancelled = updatedContent
        .filter((item) => item.isCancelled === true)
        .map((item) => item.callId)

      await this.chatMessageService.delete(
        {
          id: data.chatMessageId,
        },
        user,
        externalSession
      )

      const job = await langgraphQueue.add('review', {
        payload: new Command({ resume: { toolsConfirmed, toolsCancelled } }),
        config,
      })

      return {
        jobId: job.id,
        chatMessage,
      }
    } else {
      return {
        jobId: null,
        chatMessage,
      }
    }
  }

  public async getAll(
    criteria: ChatCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IChat[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const chats = await this.repository.find(filter, session)

    return chats.map((ws) => toServerCaseKeys(ws))
  }
}
