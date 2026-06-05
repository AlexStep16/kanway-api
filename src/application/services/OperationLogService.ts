import OperationLogRepository from '@repositories/OperationLogRepository.js'
import { IOperationLog } from '@entities/IOperationLog.js'
import { OperationLogCreationDTO } from '@dtos/OperationLogCreationDTO.js'
import mongoose, { ClientSession, Types } from 'mongoose'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { IUser } from '@/domain/entities/IUser.js'
import { IRevertableService } from '@traits/IRevertableService.js'
import { IOperationLogCriteria } from '../interfaces/criterias/IOperationLogCriteria.js'
import { AppError } from '@/domain/errors/AppError.js'
import { BaseService } from './BaseService.js'
import { IOperationLogCreatePayload } from '../interfaces/IOperationLogCreatePayload.js'
import { toMongoCaseKeys } from '@/utils/objectTransformers.js'
import { CategoryService } from './CategoryService.js'
import { BoardService } from './BoardService.js'
import { WorkspaceService } from './WorkspaceService.js'
import { IResponseWithLog } from '../interfaces/IResponseWithLog.js'

const MAX_RETRIES = 3

export class OperationLogService extends BaseService<
  IOperationLogRaw,
  IOperationLog,
  IOperationLogCriteria
> {
  protected repository: OperationLogRepository
  private revertAdapters: Map<string, IRevertableService>

  private categoryService: CategoryService
  private boardService: BoardService
  private workspaceService: WorkspaceService

  constructor(
    operationLogRepository: OperationLogRepository,
    revertServices: Map<string, IRevertableService>,

    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
  ) {
    super(operationLogRepository)

    this.repository = operationLogRepository
    this.revertAdapters = revertServices

    this.categoryService = categoryService
    this.boardService = boardService
    this.workspaceService = workspaceService
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

  public async edit(
    data: Partial<OperationLogCreationDTO>,
    criteria: IOperationLogCriteria,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IOperationLog[]> {
    const payload = toMongoCaseKeys<IOperationLog>(data)

    await this.repository.updateManyByCriteria(criteria, payload, session, userId)

    return await this.getByCriteria(criteria, userId, session)
  }

  public async create(
    data: OperationLogCreationDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IOperationLog> {
    const operationLogPayload: IOperationLogCreatePayload = {
      ...data,
      userId,
    }

    return await this.repository.create(operationLogPayload, session)
  }

  private async _recursiveRevert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<any>[]> {
    const service = this.revertAdapters.get(log.collectionName)
    const dependencies: IOperationLog[] = []
    const results: IResponseWithLog<any>[] = []

    if (log.dependencies && log.dependencies.length > 0) {
      const depLogs = await this.repository.findByCriteria(
        { ids: log.dependencies.map((id) => id.toString()) },
        session,
        undefined,
        user.id,
      )

      dependencies.push(...depLogs)
    }

    if (!service) {
      throw new AppError(`Нет адаптера для сущности: ${log.collectionName}`, 400)
    }

    results.push(await service.revert(log, user, session, isDryRun))

    if (dependencies.length > 0) {
      for (const depLog of dependencies) {
        const depResult = await this._recursiveRevert(depLog, user, session, isDryRun)

        results.push(...depResult)
      }
    }

    return results
  }

  private async _executeUndoOperations(
    logIds: string[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<any>[]> {
    const logs = await this.repository.findByCriteria({ ids: logIds }, session, undefined, user.id)
    const results: IResponseWithLog<any>[] = []

    if (logs.length === 0) {
      throw new AppError(ErrorMessages.OPERATION_LOGS_NOT_FOUND, 404)
    }

    for (const log of logs) {
      if (log.isUndone) continue

      const result = await this._recursiveRevert(log, user, session, isDryRun)

      results.push(...result)
    }

    return results
  }

  public async undoOperations(
    logIds: string[],
    user: IUser,
    externalSession: ClientSession | null = null,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<any>[]> {
    if (externalSession) {
      return this._executeUndoOperations(logIds, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeUndoOperations(logIds, user, session, isDryRun),
      )
    }
  }

  public async populateEntities(
    entitiesBefore: any[],
    entitiesAfter: any[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ) {
    const uniqueCategoryIds = new Set<string>()
    const uniqueBoardIds = new Set<string>()
    const uniqueWorkspaceIds = new Set<string>()

    const allEntities = [...entitiesBefore, ...entitiesAfter]

    for (const entity of allEntities) {
      if (entity.category) uniqueCategoryIds.add(entity.category.toString())
      if (entity.board) uniqueBoardIds.add(entity.board.toString())
      if (entity.workspace) uniqueWorkspaceIds.add(entity.workspace.toString())
    }

    const [categories, boards, workspaces] = await Promise.all([
      this.categoryService.getByCriteria({ ids: Array.from(uniqueCategoryIds) }, userId, session),
      this.boardService.getByCriteria({ ids: Array.from(uniqueBoardIds) }, userId, session),
      this.workspaceService.getByCriteria({ ids: Array.from(uniqueWorkspaceIds) }, userId, session),
    ])

    const createMap = (items: any[]) =>
      new Map(items.map((item) => [item.id.toString(), { id: item.id, name: item.name }]))

    const categoryMap = createMap(categories)
    const boardMap = createMap(boards)
    const workspaceMap = createMap(workspaces)

    const populateEntity = (entity: any) => {
      const catId = entity.category?.toString()
      const brdId = entity.board?.toString()
      const wrkId = entity.workspace?.toString()

      if (categoryMap.has(catId)) entity.category = categoryMap.get(catId)
      if (boardMap.has(brdId)) entity.board = boardMap.get(brdId)
      if (workspaceMap.has(wrkId)) entity.workspace = workspaceMap.get(wrkId)
    }

    entitiesBefore.forEach(populateEntity)
    entitiesAfter.forEach(populateEntity)
  }
}
