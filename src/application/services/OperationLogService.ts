import OperationLogRepository from '@repositories/OperationLogRepository.ts'
import { ICreateOperationLogService } from '@traits/ICreateOperationLogService.ts'
import { IOperationLog } from '@entities/IOperationLog.ts'
import { OperationLogCreationDTO } from '@dtos/OperationLogCreationDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { toMongoCaseKeys, toServerCaseKeys } from '@utils/objectTransformers.ts'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.ts'
import { SystemFields } from '@/infrastructure/types/SystemFields.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { IRevertableService } from '@traits/IRevertableService.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'

const MAX_RETRIES = 3

export class OperationLogService
  implements ICreateOperationLogService<IOperationLog, OperationLogCreationDTO>
{
  protected repository: OperationLogRepository
  private revertAdapters: Map<string, IRevertableService<any>>

  constructor(
    operationLogRepository: OperationLogRepository,
    revertServices: Map<string, IRevertableService<any>>
  ) {
    this.repository = operationLogRepository
    this.revertAdapters = revertServices
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

  public async create(
    data: OperationLogCreationDTO,
    userId: Types.ObjectId,
    session: ClientSession | null = null
  ): Promise<IOperationLog[]> {
    const operationLogPayload: Omit<IOperationLogRaw, SystemFields> = {
      ...toMongoCaseKeys(data),
      user_id: userId,
    }

    const newOperationLog = await this.repository.create(operationLogPayload, session)

    return [toServerCaseKeys(newOperationLog)]
  }

  private async _executeUndoOperation(
    logId: string,
    user: IUser,
    session: ClientSession
  ): Promise<IResponseWithLog<IUndoResponse<any>>> {
    const log = await this.repository.findByIdAndUser(logId, user.id, session)

    if (!log) {
      throw new Error(ErrorsMessage.OPERATION_LOG_NOT_FOUND)
    }

    const service = this.revertAdapters.get(log.collection_name)

    if (!service) {
      throw new Error(`Нет адаптера для сущности: ${log.collection_name}`)
    }

    return await service.revert(toServerCaseKeys<IOperationLog>(log), user, session)
  }

  public async undoOperation(
    logId: string,
    user: IUser,
    externalSession: ClientSession | null = null
  ): Promise<IResponseWithLog<IUndoResponse<any>>> {
    if (externalSession) {
      return this._executeUndoOperation(logId, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeUndoOperation(logId, user, session)
      )
    }
  }
}
