import OperationLogRepository from '@repositories/OperationLogRepository.ts'
import { IOperationLog } from '@entities/IOperationLog.ts'
import { OperationLogCreationDTO } from '@dtos/OperationLogCreationDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.ts'
import { SystemFields } from '@/infrastructure/types/SystemFields.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { IRevertableService } from '@traits/IRevertableService.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'
import { IOperationLogCriteria } from '../interfaces/criterias/IOperationLogCriteria.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { BaseService } from './BaseService.ts'

const MAX_RETRIES = 3

export class OperationLogService extends BaseService<
  IOperationLogRaw,
  IOperationLog,
  IOperationLogCriteria
> {
  protected repository: OperationLogRepository
  private revertAdapters: Map<string, IRevertableService<any>>

  constructor(
    operationLogRepository: OperationLogRepository,
    revertServices: Map<string, IRevertableService<any>>
  ) {
    super(operationLogRepository)

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
    throw new AppError(
      'Произошла ошибка при выполнении операции после максимального количества попыток.',
      500
    )
  }

  public async create(
    data: OperationLogCreationDTO,
    userId: Types.ObjectId,
    session: ClientSession | null = null
  ): Promise<IOperationLog> {
    const operationLogPayload: Omit<IOperationLog, SystemFields> = {
      ...data,
      isUndone: false,
      userId,
    }

    return await this.repository.create(operationLogPayload, session)
  }

  private async _recursiveRevert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession
  ): Promise<IUndoResponse<any>[]> {
    const service = this.revertAdapters.get(log.collectionName)
    const dependencies: IOperationLog[] = []
    const results: IUndoResponse<any>[] = []

    if (log.dependencies && log.dependencies.length > 0) {
      const depLogs = await this.repository.findByCriteria(
        { ids: log.dependencies.map((id) => id.toString()) },
        session,
        undefined,
        user.id
      )

      dependencies.push(...depLogs)
    }

    if (!service) {
      throw new AppError(`Нет адаптера для сущности: ${log.collectionName}`, 400)
    }

    results.push(await service.revert(log, user, session))

    if (dependencies.length > 0) {
      for (const depLog of dependencies) {
        const depResult = await this._recursiveRevert(depLog, user, session)

        results.push(...depResult)
      }
    }

    return results
  }

  private async _executeUndoOperations(
    logIds: string[],
    user: IUser,
    session: ClientSession
  ): Promise<IUndoResponse<any>> {
    const logs = await this.repository.findByCriteria({ ids: logIds }, session, undefined, user.id)
    const results: IUndoResponse<any>[] = []

    if (!logs) {
      throw new AppError(ErrorMessages.OPERATION_LOGS_NOT_FOUND, 404)
    }

    for (const log of logs) {
      const result = await this._recursiveRevert(log, user, session)

      results.push(...result)
    }

    return this.combineUndoResult(results)
  }

  public async combineUndoResult(result: IUndoResponse<any>[]): Promise<IUndoResponse<any>> {
    const combinedResult: IUndoResponse<any> = {}

    for (const res of result) {
      for (const key in res) {
        if (!combinedResult[key as keyof IUndoResponse<any>]) {
          combinedResult[key as keyof IUndoResponse<any>] = res[key as keyof IUndoResponse<any>]
        } else {
          const existingArray = combinedResult[key as keyof IUndoResponse<any>] as any[]
          const newArray = res[key as keyof IUndoResponse<any>] as any[]
          combinedResult[key as keyof IUndoResponse<any>] = existingArray.concat(newArray)
        }
      }
    }

    return combinedResult
  }

  public async undoOperations(
    logIds: string[],
    user: IUser,
    externalSession: ClientSession | null = null
  ): Promise<IUndoResponse<any>> {
    if (externalSession) {
      return this._executeUndoOperations(logIds, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeUndoOperations(logIds, user, session)
      )
    }
  }
}
