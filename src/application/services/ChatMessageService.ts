import ChatMessageRepository from '@repositories/ChatMessageRepository.js'
import { ChatMessageDTO } from '@dtos/ChatMessageDTO.js'
import { IUser } from '@/domain/entities/IUser.js'
import { OperationLogService } from './OperationLogService.js'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.js'
import { CollectionsEnum } from '@/domain/enums/CollectionsEnum.js'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'
import { IChatMessage } from '@/domain/entities/IChatMessage.js'
import { IChatMessageCriteria } from '@interfaces/criterias/IChatMessageCriteria.js'
import { NotFoundError } from '@/domain/errors/NotFound.js'
import { AppError } from '@/domain/errors/AppError.js'
import { BaseService } from './BaseService.js'
import { IChatMessageRaw } from '@/domain/entities/IChatMessageRaw.js'
import { RateMessageDTO } from '../dtos/RateMessageDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

const MAX_RETRIES = 3

export class ChatMessageService extends BaseService<
  IChatMessageRaw,
  IChatMessage,
  IChatMessageCriteria
> {
  protected repository: ChatMessageRepository
  protected operationLogService: OperationLogService

  constructor(
    chatMessageRepository: ChatMessageRepository,
    operationLogService: OperationLogService,
  ) {
    super(chatMessageRepository)

    this.repository = chatMessageRepository
    this.operationLogService = operationLogService
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
      'Произошла ошибка при выполнении операции после максимального количества попыток',
      500,
    )
  }

  public async rateMessage(data: RateMessageDTO, id: string, user: IUser) {
    const { rating } = data
    const messagesCount = await this.getCount({ id }, user.id)

    if (messagesCount === 0) {
      throw new NotFoundError(ErrorMessages.MESSAGE_NOT_FOUND)
    }

    const result = await this.edit(
      {
        rating,
      },
      { id },
      user,
    )

    return result
  }

  private async _executeEditTransaction(
    data: Partial<ChatMessageDTO>,
    criteria: IChatMessageCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IChatMessage> {
    const updateChatMessagesResult = await this.repository.updateManyByCriteria(
      criteria,
      data,
      session,
      userId,
    )

    if (updateChatMessagesResult.matchedCount === 0) {
      throw new NotFoundError('Сообщения не найдены.')
    }

    const chatMessages = await this.repository.findByCriteria(criteria, session, undefined, userId)

    const chatMessage = chatMessages[0]

    if (!chatMessage) throw new NotFoundError('Сообщение не было обновлено.')

    return chatMessage
  }

  private async _executeCreateManyTransaction(
    data: ChatMessageDTO[],
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IChatMessage[]>> {
    const chatMessages = await this.repository.createMany(
      data.map((dto) => ({
        ...dto,
        userId: user.id,
      })),
      session,
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CHAT_HISTORIES,
        entitiesAfter: chatMessages,
        dependencies: [],
      },
      user.id,
      session,
    )

    return {
      data: chatMessages,
      logId: log.id,
    }
  }

  private async _executeCreateTransaction(
    data: ChatMessageDTO,
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IChatMessage[]>> {
    const chatMessage = await this.repository.create(
      {
        role: data.role,
        content: data.content,
        listType: data.listType,
        pendingToolCallId: data.pendingToolCallId,
        iterationId: data.iterationId,
        userId: user.id,
        chatId: data.chatId,
        threadId: data.threadId,
      },
      session,
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CHAT_HISTORIES,
        entitiesAfter: [chatMessage],
        dependencies: [],
      },
      user.id,
      session,
    )

    return {
      data: [chatMessage],
      logId: log.id,
    }
  }

  public async create(
    data: ChatMessageDTO,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IChatMessage[]>> {
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session),
      )
    }
  }

  public async createMany(
    data: ChatMessageDTO[],
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IChatMessage[]>> {
    if (externalSession) {
      return this._executeCreateManyTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, user, session),
      )
    }
  }

  public async edit(
    data: Partial<ChatMessageDTO>,
    criteria: IChatMessageCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IChatMessage> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session),
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: IChatMessageCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await this.repository.deleteMany(criteria, userId, session)
  }

  public async delete(
    criteria: IChatMessageCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<void> {
    const userId = user.id

    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session),
      )
    }
  }
}
