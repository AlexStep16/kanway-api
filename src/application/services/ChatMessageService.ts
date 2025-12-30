import ChatMessageRepository from '@repositories/ChatMessageRepository.ts'
import { ICreateService } from '@interfaces/traits/ICreateService.ts'
import { ChatMessageDTO } from '@dtos/ChatMessageDTO.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { OperationLogService } from './OperationLogService.ts'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@/domain/enums/CollectionsEnum.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IChatMessage } from '@/domain/entities/IChatMessage.ts'
import { toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { ChatMessageCriteria } from '@interfaces/criterias/ChatMessageCriteria.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { IChatMessageRaw } from '@entities/IChatMessageRaw.ts'

const MAX_RETRIES = 3

export class ChatMessageService implements ICreateService<IChatMessage, ChatMessageDTO> {
  protected repository: ChatMessageRepository
  protected operationLogService: OperationLogService

  constructor(
    ChatMessageRepository: ChatMessageRepository,
    operationLogService: OperationLogService
  ) {
    this.repository = ChatMessageRepository
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
    throw new Error(
      'Произошла ошибка при выполнении операции после максимального количества попыток.'
    )
  }

  private async _executeEditTransaction(
    data: Partial<ChatMessageDTO>,
    criteria: ChatMessageCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IChatMessage> {
    const filter = this.repository.buildFilter(criteria, userId)

    const chatMessagesCount = await this.repository.getCount(filter, session)

    if (chatMessagesCount === 0) throw new NotFoundError('Сообщения для редактирования не найдены.')

    const newEntities = await this.repository.updateByFilter(filter, data, session)
    const chatMessage = newEntities[0] as IChatMessageRaw

    if (!chatMessage) throw new NotFoundError('Сообщение не было обновлено.')

    return toServerCaseKeys<IChatMessage>(chatMessage)
  }

  private async _executeCreateTransaction(
    data: ChatMessageDTO,
    user: IUser,
    session: ClientSession
  ): Promise<IResponseWithLog<IChatMessage[]>> {
    const ChatMessage = await this.repository.create(
      {
        role: data.role,
        content: data.content,
        list_type: data.listType,
        user_id: user.id,
        chat_id: data.chatId,
        thread_id: data.threadId,
      },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CHAT_HISTORIES,
        entitiesAfter: [ChatMessage],
        dependencies: [],
      },
      user.id,
      session
    )

    return {
      data: [toServerCaseKeys<IChatMessage>(ChatMessage)],
      logId: log[0].id,
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
    criteria: ChatMessageCriteria,
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
    criteria: ChatMessageCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<void> {
    const filter = this.repository.buildFilter(criteria, userId)

    await this.repository.deleteMany(filter, session)
  }

  public async delete(
    criteria: ChatMessageCriteria,
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

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IChatMessage | null> {
    const chatMessage = await this.repository.findByIdAndUser(id, userId, session)

    return chatMessage ? toServerCaseKeys<IChatMessage>(chatMessage) : null
  }

  public async getAll(
    criteria: ChatMessageCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IChatMessage[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const chats = await this.repository.find(filter, session)

    return chats.map((ws) => toServerCaseKeys(ws))
  }
}
