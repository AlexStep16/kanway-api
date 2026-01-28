import { IBoard } from '@entities/IBoard.ts'
import { IBoardRaw } from '@entities/IBoardRaw.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import mongoose, {
  ClientSession,
  MongooseBulkWriteResult,
  Types,
  UpdateWriteOpResult,
} from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { IBoardCriteria } from '@criterias/IBoardCriteria.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.ts'
import { IUser } from '@entities/IUser.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { LifecycleDTO } from '../dtos/LifecycleDTO.ts'
import { WorkspaceService } from './WorkspaceService.ts'
import { BaseService } from './BaseService.ts'
import { IBoardPopulated } from '../interfaces/IBoardPopulated.ts'
import { IBoardCreatePayload } from '../interfaces/IBoardCreatePayload.ts'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.ts'

const MAX_RETRIES = 3

type ReorderServiceType = ReorderService<
  IBoard,
  IBoardRaw,
  IBoardCriteria,
  IBoardPopulated,
  IBoardCreatePayload
>

export class BoardService extends BaseService<
  IBoardRaw,
  IBoard,
  IBoardCriteria,
  IBoardPopulated,
  IBoardCreatePayload
> {
  protected repository: BoardRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderServiceType
  protected workspaceService: WorkspaceService
  protected categoryService: CategoryService
  protected taskService: TaskService

  constructor(
    boardRepository: BoardRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderServiceType,
    workspaceService: WorkspaceService,
    categoryService: CategoryService,
    taskService: TaskService,
  ) {
    super(boardRepository)

    this.repository = boardRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.workspaceService = workspaceService
    this.categoryService = categoryService
    this.taskService = taskService
  }

  protected getPopulateOptions() {
    return [{ path: 'workspace', select: 'name' }]
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

  private async _executeCreateTransaction(
    data: BoardDTO,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardPayload = await this.prepareBoardCreationPayload(data, userId, session)

    const sideEffects: Promise<any>[] = []

    /* CREATE */
    const newBoard = await this.repository.create(boardPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      sideEffects.push(this.reorderService.reorder('workspace', [newBoard], userId, session))
    }

    /* UPDATE COUNTERS */
    sideEffects.push(
      this.workspaceService.updateBoardsCount(
        [new Types.ObjectId(newBoard.workspace.id)],
        userId,
        session,
      ),
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: [newBoard],
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const newBoardsPopulated = await this.getByCriteria(
      { id: newBoard.id.toString() },
      userId,
      session,
    )

    return {
      data: newBoardsPopulated,
      logId: log.id,
    }
  }

  public async create(
    data: BoardDTO,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, userId, session),
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: BoardDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardsPayload = await this.prepareBoardsCreationPayload(data, userId, session)

    /* CREATE */
    const newBoards = await this.repository.createMany(boardsPayload, session)

    const sideEffects: Promise<any>[] = []

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      sideEffects.push(this.reorderService.reorder('workspace', newBoards, userId, session))
    }

    const uniqueWorkspaceIds = [...new Set(newBoards.map((board) => board.workspace.toHexString()))]

    /** UPDATE COUNTERS */
    sideEffects.push(
      this.workspaceService.updateBoardsCount(
        uniqueWorkspaceIds.map((id) => new Types.ObjectId(id)),
        userId,
        session,
      ),
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: newBoards,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const newBoardsPopulated = await this.getByCriteria(
      { ids: newBoards.map((b) => b.id.toString()) },
      userId,
      session,
    )

    return {
      data: newBoardsPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: BoardDTO[],
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session),
      )
    }
  }

  private async _executeEditTransaction(
    data: BoardEditDTO,
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardsToUpdate: IBoard[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (boardsToUpdate.length === 0) throw new NotFoundError('Доски для редактирования не найдены.')

    const boardPayload = await this.prepareBoardEditPayload(data, boardsToUpdate)
    const boardsBefore = projectProperties<IBoard>(boardsToUpdate, boardPayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      boardPayload,
      session,
      userId,
    )

    if (updateManyResult.modifiedCount === 0) throw new AppError('Не удалось обновить доски.', 500)

    const updatedBoards = await this.repository.findByCriteria<IBoard>(
      criteria,
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    /* MOVE */
    const boardsToMove = boardsToUpdate.filter(
      (b) => data.workspaceId !== undefined && b.workspace.toString() !== data.workspaceId,
    )

    if (boardsToMove.length > 0) {
      const affectedCategoriesPromise = this.categoryService.getByCriteria(
        { boardIds: boardsToMove.map((b) => b.id.toString()) },
        userId,
        session,
        { projection: { _id: 1 } },
      )
      const affectedTasksPromise = this.taskService.getByCriteria(
        { boardIds: boardsToMove.map((b) => b.id.toString()) },
        userId,
        session,
        { projection: { _id: 1 } },
      )

      const [affectedCategories, affectedTasks] = await Promise.all([
        affectedCategoriesPromise,
        affectedTasksPromise,
      ])

      if (affectedCategories.length > 0) {
        sideEffects.push(
          this.categoryService.regenerateReferencesByBoards(
            affectedCategories.map((c) => c.id.toString()),
            userId,
            session,
          ),
        )
      }

      if (affectedTasks.length > 0) {
        sideEffects.push(
          this.taskService.regenerateReferencesByBoards(
            affectedTasks.map((t) => t.id.toString()),
            userId,
            session,
          ),
        )
      }

      const movedIds = boardsToMove.map((b) => b.id.toString())
      const boardsAfterMove = updatedBoards.filter((b) => movedIds.includes(b.id.toString()))

      sideEffects.push(
        ...this._updateBoardsParentCountersWithOld(boardsToMove, boardsAfterMove, userId, session),
      )
    }

    /* REORDER */
    const boardsToReorder = boardsToUpdate.filter(
      (b) => data.order !== undefined && b.order !== data.order,
    )

    const boardsToMoveToEnd = boardsToUpdate.filter(
      (b) => data.order == null && boardsToMove.includes(b),
    )

    if (boardsToReorder.length > 0 || boardsToMoveToEnd.length > 0) {
      sideEffects.push(
        this.reorderService.reorder(
          'workspace',
          [
            ...boardsToReorder,
            ...boardsToMoveToEnd.map((b) => ({
              ...b,
              order: b.order + 99999,
            })),
          ],
          userId,
          session,
        ),
      )
    }

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedBoardsPopulated = await this.getByCriteria(criteria, userId, session)

    return {
      data: updatedBoardsPopulated,
      logId: log.id,
    }
  }

  public async edit(
    data: BoardEditDTO,
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session),
      )
    }
  }

  private async _executeEditManyTransaction(
    data: BoardEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardIds = data.map((d) => d.id)

    const existingBoards = await this.repository.findByCriteria(
      { ids: boardIds },
      session,
      undefined,
      userId,
    )

    if (existingBoards.length === 0) {
      throw new NotFoundError('Доски для обновления не найдены.')
    }

    const existingMap = new Map(existingBoards.map((b) => [b.id.toString(), b]))

    const boardPayloads: SingleUpdateDTO<SafeUpdateData<IBoard>>[] = []
    const boardsBefore: Partial<IBoard>[] = []
    const movedBoardIds: string[] = []
    const reorderBoardIds = new Set<string>()
    const moveToEndIds = new Set<string>()

    for (const dto of data) {
      const board = existingMap.get(dto.id)
      if (!board) continue

      const boardPayload = await this.prepareBoardEditPayload(dto, [board])

      boardsBefore.push(projectProperties<IBoard>([board], boardPayload)[0])
      boardPayloads.push(boardPayload)

      const isMoving =
        dto.workspaceId !== undefined && board.workspace.toString() !== dto.workspaceId
      if (isMoving) {
        movedBoardIds.push(dto.id)
      }

      if (dto.order !== undefined && board.order !== dto.order) {
        reorderBoardIds.add(dto.id)
      } else if (dto.order == null && isMoving) {
        reorderBoardIds.add(dto.id)
        moveToEndIds.add(dto.id)
      }
    }

    const updatedBoardsResult = await this.repository.bulkUpdate(boardPayloads, userId, session)

    if (!updatedBoardsResult || updatedBoardsResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить доски.', 500)
    }

    const updatedBoards = await this.repository.findByCriteria(
      { ids: boardPayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    /** MOVE */
    if (movedBoardIds.length > 0) {
      const affectedCategoriesPromise = this.categoryService.getByCriteria(
        { boardIds: movedBoardIds },
        userId,
        session,
        { projection: { _id: 1 } },
      )
      const affectedTasksPromise = this.taskService.getByCriteria(
        { boardIds: movedBoardIds },
        userId,
        session,
        { projection: { _id: 1 } },
      )

      const [affectedCategories, affectedTasks] = await Promise.all([
        affectedCategoriesPromise,
        affectedTasksPromise,
      ])

      if (affectedCategories.length > 0) {
        sideEffects.push(
          this.categoryService.regenerateReferencesByBoards(
            affectedCategories.map((c) => c.id.toString()),
            userId,
            session,
          ),
        )
      }

      if (affectedTasks.length > 0) {
        sideEffects.push(
          this.taskService.regenerateReferencesByBoards(
            affectedTasks.map((t) => t.id.toString()),
            userId,
            session,
          ),
        )
      }

      const boardsToMove = existingBoards.filter((b) => movedBoardIds.includes(b.id.toString()))
      const boardsAfterMove = updatedBoards.filter((b) => movedBoardIds.includes(b.id.toString()))

      sideEffects.push(
        ...this._updateBoardsParentCountersWithOld(boardsToMove, boardsAfterMove, userId, session),
      )
    }

    /** REORDER */
    if (reorderBoardIds.size > 0) {
      const boardsToReorder = updatedBoards
        .filter((b) => reorderBoardIds.has(b.id.toString()))
        .map((b) => {
          if (moveToEndIds.has(b.id.toString())) {
            return { ...b, order: b.order + 99999 } // Сдвигаем виртуально
          }
          return b
        })

      sideEffects.push(this.reorderService.reorder('workspace', boardsToReorder, userId, session))
    }

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    const updatedBoardsPopulated = await this.getByCriteria({ ids: boardIds }, userId, session)

    return {
      data: updatedBoardsPopulated,
      logId: log.id,
    }
  }

  public async editMany(
    data: BoardEditDTO[],
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session),
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    const boardsToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (boardsToDelete.length === 0) {
      throw new NotFoundError('Доски для удаления не найдены.')
    }

    const uniqueWorkspaceIds = [...new Set(boardsToDelete.map((t) => t.workspace.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    await this.repository.deleteMany(criteria, userId, session)

    await Promise.all([
      this.taskService.deleteTasksByCriteria(
        { boardIds: boardsToDelete.map((b) => b.id.toString()) },
        userId,
        session,
      ),
      this.categoryService.deleteCategoriesByCriteria(
        { boardIds: boardsToDelete.map((b) => b.id.toString()) },
        userId,
        session,
      ),

      ...this._updateBoardsParentCounters(boardsToDelete, userId, session),

      this.reorderService.reorderByParentIds(uniqueWorkspaceIds, 'workspace', userId, session),
    ])
  }

  public async delete(
    criteria: IBoardCriteria,
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

  private async _executeLifecycleTransaction(
    criteria: IBoardCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const deleteData: LifecycleDTO = {
      isDeleted: true,
      isDeletedExternal: false,
      deletedTime: new Date(),
    }
    const recoverData: LifecycleDTO = {
      isDeleted: false,
      isDeletedExternal: false,
      deletedTime: null,
    }
    const data = isRecover ? recoverData : deleteData
    const childrenData = { ...data, isDeletedExternal: isRecover ? false : true }

    const boardsToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    const boardsCriteria = { boardIds: boardsToProcess.map((b) => b.id.toString()) }

    if (boardsToProcess.length === 0) throw new NotFoundError('Доски не найдены.')

    await Promise.all([
      /* PROCESS CHILDREN */
      this.taskService.updateLifecycleTasksByCriteria(
        boardsCriteria,
        childrenData,
        userId,
        session,
      ),
      this.categoryService.updateLifecycleCategoriesByCriteria(
        boardsCriteria,
        childrenData,
        userId,
        session,
      ),

      /* PROCESS BOARDS */
      this.repository.updateManyByCriteria(criteria, data, session, userId),
    ])

    const sideEffects: Promise<any>[] = []

    const entitiesAfter = boardsToProcess.map((board) => ({
      ...board,
      isDeleted: data.isDeleted,
    }))

    /* REORDER */
    sideEffects.push(
      this.reorderService.reorderByParentIds(
        boardsToProcess.map((b) => b.workspace),
        'workspace',
        userId,
        session,
      ),
    )

    /** UPDATE COUNTERS */
    sideEffects.push(...this._updateBoardsParentCounters(boardsToProcess, userId, session))

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsToProcess,
        entitiesAfter: entitiesAfter,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedBoardsPopulated = await this.getByCriteria(
      { ids: entitiesAfter.map((b) => b.id.toString()) },
      userId,
      session,
    )

    return {
      data: updatedBoardsPopulated,
      logId: log.id,
    }
  }

  public async archive(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, userId, session),
      )
    }
  }

  public async recover(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, userId, session),
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const filter = this.repository.buildFilter(criteria, userId)
    const dependencies: Types.ObjectId[] = []

    const boardsToClone = await this.repository.findByCriteria(
      filter,
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId,
    )

    if (boardsToClone.length === 0) throw new NotFoundError('Доски для клонирования не найдены.')

    const boardsGroupedByWorkspace: Map<string, IBoard[]> = new Map()

    boardsToClone.forEach((board) => {
      const workspaceId = board.workspace.toString()

      if (!boardsGroupedByWorkspace.has(workspaceId)) {
        boardsGroupedByWorkspace.set(workspaceId, [])
      }

      boardsGroupedByWorkspace.get(workspaceId)!.push(board)
    })

    const transformedBoards: Omit<IBoard, 'id'>[] = []

    for (const [workspaceId, boards] of boardsGroupedByWorkspace) {
      const workspaceBoards = boardsToClone.filter((b) => b.workspace.toString() === workspaceId)

      let currentMaxOrder = workspaceBoards.reduce((max, t) => (t.order > max ? t.order : max), 0)

      for (const board of boards) {
        const cleanBoard = {
          ...board,
          id: undefined,
          order: ++currentMaxOrder,
        }

        transformedBoards.push(cleanBoard)
      }
    }

    const clonedBoards = await this.repository.createMany(transformedBoards, session)

    const boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    > = new Map()

    boardsToClone.forEach((board, index) => {
      boardIdsMap.set(board.id.toString(), {
        boardId: clonedBoards[index].id,
        workspaceId: clonedBoards[index].workspace,
      })
    })

    const cloneCategoriesResult = await this.categoryService.cloneCategoriesByBoards(
      boardIdsMap,
      userId,
      session,
    )

    if (cloneCategoriesResult.logId) dependencies.push(cloneCategoriesResult.logId)

    /* REORDER */
    await this.reorderService.reorderByParentIds(
      clonedBoards.map((b) => b.workspace),
      'workspace',
      userId,
      session,
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: clonedBoards,
        dependencies,
      },
      userId,
      session,
    )

    await Promise.all([
      logPromise,
      ...this._updateBoardsParentCounters(clonedBoards, userId, session),
    ])

    const log = await logPromise

    const clonedBoardsPopulated = await this.getByCriteria(
      { ids: clonedBoards.map((b) => b.id.toString()) },
      userId,
      session,
    )

    return {
      data: clonedBoardsPopulated,
      logId: log.id,
    }
  }

  public async clone(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCloneTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, userId, session),
      )
    }
  }

  public async revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession,
  ): Promise<IUndoResponse> {
    const { operationType } = log

    const before = log.entitiesBefore as (Partial<IBoard> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<IBoard> & { id: Types.ObjectId })[]

    const idsBefore = before?.map((e) => e.id?.toString()) || []
    const idsAfter = after?.map((e) => e.id?.toString()) || []

    switch (operationType) {
      case OperationTypesEnum.CREATE: {
        await this.delete({ ids: idsAfter }, user, session)
        break
      }

      case OperationTypesEnum.UPDATE: {
        const payload = before.map((e) => ({
          ...e,
          id: e.id?.toString(),
        }))

        await this.editMany(payload, user, session)
        break
      }

      case OperationTypesEnum.ARCHIVE: {
        await this.recover({ ids: idsBefore }, user, session)
        break
      }

      case OperationTypesEnum.RECOVER: {
        await this.archive({ ids: idsBefore }, user, session)
        break
      }

      default:
        throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
    }

    return {
      affectedBoardIds: [...new Set([...idsBefore, ...idsAfter])],
    }
  }

  public async updateLifecycleBoardsByCriteria(
    criteria: IBoardCriteria,
    data: SafeUpdateData<IBoard>,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    await this.repository.findByCriteria(criteria, session, undefined, userId)

    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
  }

  public async deleteBoardsByCriteria(
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    const filter = this.repository.buildFilter(criteria, userId)

    await this.repository.deleteMany(filter, userId, session)
  }

  public async cloneBoardsByWorkspaces(
    workspaceIdsMap: Map<
      string,
      {
        workspaceId: Types.ObjectId
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoard[]>> {
    const workspaceIds = Array.from(workspaceIdsMap.keys())
    const dependencies: Types.ObjectId[] = []

    const filter = this.repository.buildFilter({ workspaceIds }, userId)

    const sourceBoards = await this.repository.findByCriteria(filter, session, undefined, userId)

    const cleanBoards = sourceBoards.map((board) => {
      const workpsaceData = workspaceIdsMap.get(board.workspace.toString())

      if (!workpsaceData) {
        throw new AppError(
          'Не удалось найти данные рабочего пространства для клонирования доски.',
          400,
        )
      }

      return {
        ...board,
        workspace: workpsaceData.workspaceId,
        _id: undefined,
      }
    })

    const clonedBoards = await this.repository.createMany(cleanBoards, session)

    const boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    > = new Map()

    sourceBoards.forEach((board, index) => {
      boardIdsMap.set(board.id.toString(), {
        boardId: clonedBoards[index].id,
        workspaceId: clonedBoards[index].workspace,
      })
    })

    const categoriesCloneResult = await this.categoryService.cloneCategoriesByBoards(
      boardIdsMap,
      userId,
      session,
    )

    if (categoriesCloneResult.logId) dependencies.push(categoriesCloneResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: clonedBoards,
        dependencies,
      },
      userId,
      session,
    )

    return {
      data: clonedBoards,
      logId: log.id,
    }
  }

  private async prepareBoardCreationPayload(
    data: BoardDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBoardCreatePayload> {
    const boardName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(boardName)

    const boardPayload: IBoardCreatePayload = {
      name: boardName,
      workspace: Types.ObjectId.createFromHexString(data.workspaceId),
      order: data.order || 1,
      embeddings,
      userId,
    }

    if (data.order === undefined) {
      const lastOrder = await this.repository.getLastOrderGroupedByParents(
        [Types.ObjectId.createFromHexString(data.workspaceId)],
        'workspace',
        userId,
        session,
      )
      boardPayload.order = lastOrder.length > 0 ? lastOrder[0].lastOrder + 1 : 1
    }

    return boardPayload
  }

  private async prepareBoardsCreationPayload(
    data: BoardDTO[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IBoardCreatePayload[]> {
    const boardsPayloads: IBoardCreatePayload[] = []
    const boardsGroupedByWorkspace: { [key: string]: BoardDTO[] } = {}

    data.forEach((board) => {
      const wsId = board.workspaceId
      if (!boardsGroupedByWorkspace[wsId]) {
        boardsGroupedByWorkspace[wsId] = []
      }

      boardsGroupedByWorkspace[wsId].push(board)
    })

    const grouppedBoardsCount = await this.repository.getLastOrderGroupedByParents(
      Object.keys(boardsGroupedByWorkspace).map((id) => Types.ObjectId.createFromHexString(id)),
      'workspace',
      userId,
      session,
    )

    const boardNames = Array.from(new Set(data.map((board) => board.name.trim())))
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(boardNames)
    const embeddingsMap: { [key: string]: number[] } = {}
    boardNames.forEach((name, index) => {
      embeddingsMap[name] = embeddingsArray[index]
    })

    const countMap = new Map(
      grouppedBoardsCount.map((entry) => [entry._id.toString(), entry.lastOrder]),
    )

    for (const [wsId, boards] of Object.entries(boardsGroupedByWorkspace)) {
      let currentOrder = countMap.get(wsId) || 1

      for (const board of boards) {
        const boardName = board.name.trim()

        const orderToSave = board.order ?? ++currentOrder

        boardsPayloads.push({
          name: boardName,
          workspace: new Types.ObjectId(board.workspaceId),
          order: orderToSave,
          embeddings: embeddingsMap[boardName],
          userId,
        })
      }
    }

    return boardsPayloads
  }

  private async prepareBoardEditPayload(
    data: BoardEditDTO,
    boardsToUpdate: IBoard[],
  ): Promise<SingleUpdateDTO<SafeUpdateData<IBoard>>> {
    const { id, ...rest } = data

    const boardPayload: SingleUpdateDTO<SafeUpdateData<IBoard>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    if (data.workspaceId) {
      boardPayload.workspace = Types.ObjectId.createFromHexString(data.workspaceId)
    }

    if (data.name && boardsToUpdate.length > 0) {
      const needEmbeddingsUpdate = boardsToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const boardName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(boardName)

        boardPayload.embeddings = embeddings
      }
    }

    return boardPayload
  }

  private _updateBoardsParentCountersWithOld(
    oldBoards: IBoard[],
    newBoards: IBoard[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const sideEffects: Promise<any>[] = []

    const affectedWorkspaces = new Set<string>()

    oldBoards.forEach((b) => {
      affectedWorkspaces.add(b.workspace.toString())
    })

    newBoards.forEach((b) => {
      affectedWorkspaces.add(b.workspace.toString())
    })

    const uniqueWorkspaceIds = Array.from(affectedWorkspaces).map((id) => new Types.ObjectId(id))

    sideEffects.push(
      this.workspaceService.updateBoardsCount(uniqueWorkspaceIds, userId, session),
      this.workspaceService.updateCategoriesCount(uniqueWorkspaceIds, userId, session),
      this.workspaceService.updateTasksCount(uniqueWorkspaceIds, userId, session),
    )

    return sideEffects
  }

  private _updateBoardsParentCounters(
    boards: IBoard[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const uniqueWorkspaceIds = [...new Set(boards.map((b) => b.workspace.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    return [
      this.workspaceService.updateBoardsCount(uniqueWorkspaceIds, userId, session),
      this.workspaceService.updateCategoriesCount(uniqueWorkspaceIds, userId, session),
      this.workspaceService.updateTasksCount(uniqueWorkspaceIds, userId, session),
    ]
  }

  public async updateTasksCount(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<MongooseBulkWriteResult | null> {
    if (boardIds.length === 0) return null

    const tasksGroupped = await this.taskService.getTasksCountByBoards(boardIds, userId, session)

    const tasksCountMap = new Map<string, number>(
      tasksGroupped.map((tg) => [tg.parentId, tg.count]),
    )

    const bulkUpdates = boardIds.map((boardId) => ({
      id: boardId,
      tasksCount: tasksCountMap.get(boardId.toString()) || 0,
    }))

    return await this.repository.bulkUpdate(bulkUpdates, userId, session)
  }

  public async updateCategoriesCount(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<MongooseBulkWriteResult | null> {
    if (boardIds.length === 0) return null

    const categoriesGroupped = await this.categoryService.getCategoriesCountByBoards(
      boardIds,
      userId,
      session,
    )

    const categoriesCountMap = new Map<string, number>(
      categoriesGroupped.map((cg) => [cg.parentId, cg.count]),
    )

    const bulkUpdates = boardIds.map((boardId) => ({
      id: boardId,
      categoriesCount: categoriesCountMap.get(boardId.toString()) || 0,
    }))

    return await this.repository.bulkUpdate(bulkUpdates, userId, session)
  }

  public async getBoardsCountByWorkspaces(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(boardIds, 'workspace', userId, session)
  }
}
