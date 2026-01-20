import ChatMessageRepository from '@repositories/ChatMessageRepository.ts'
import { ChatMessageDTO } from '@dtos/ChatMessageDTO.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { OperationLogService } from './OperationLogService.ts'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@/domain/enums/CollectionsEnum.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IChatMessage } from '@/domain/entities/IChatMessage.ts'
import { IChatMessageCriteria } from '@interfaces/criterias/IChatMessageCriteria.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { BaseService } from './BaseService.ts'
import { IChatMessageRaw } from '@/domain/entities/IChatMessageRaw.ts'

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
    operationLogService: OperationLogService
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
      'Произошла ошибка при выполнении операции после максимального количества попыток.',
      500
    )
  }

  private async _executeEditTransaction(
    data: Partial<ChatMessageDTO>,
    criteria: IChatMessageCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IChatMessage> {
    const chatMessagesCount = await this.repository.getCount(criteria, session, userId)

    if (chatMessagesCount === 0) throw new NotFoundError('Сообщения для редактирования не найдены.')

    const updateChatMessagesResult = await this.repository.updateManyByCriteria(
      criteria,
      data,
      session,
      userId
    )

    if (updateChatMessagesResult.modifiedCount === 0) {
      throw new NotFoundError('Сообщения не были обновлены.')
    }

    const chatMessages = await this.repository.findByCriteria(criteria, session, undefined, userId)

    const chatMessage = chatMessages[0]

    if (!chatMessage) throw new NotFoundError('Сообщение не было обновлено.')

    return chatMessage
  }

  private async _executeCreateTransaction(
    data: ChatMessageDTO,
    user: IUser,
    session: ClientSession
  ): Promise<IResponseWithLog<IChatMessage[]>> {
    const chatMessage = await this.repository.create(
      {
        role: data.role,
        content: data.content,
        listType: data.listType,
        userId: user.id,
        chatId: data.chatId,
        threadId: data.threadId,
      },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CHAT_HISTORIES,
        entitiesAfter: [chatMessage],
        dependencies: [],
      },
      user.id,
      session
    )

    return {
      data: [chatMessage],
      logId: log.id,
    }
  }

  public async create(
    data: ChatMessageDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IChatMessage[]>> {
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session)
      )
    }
  }

  public async edit(
    data: Partial<ChatMessageDTO>,
    criteria: IChatMessageCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IChatMessage> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session)
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: IChatMessageCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<void> {
    await this.repository.deleteMany(criteria, userId, session)
  }

  public async delete(
    criteria: IChatMessageCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<void> {
    const userId = user.id

    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session)
      )
    }
  }
}
