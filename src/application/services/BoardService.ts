import { IBoard } from '@entities/IBoard.ts'
import { IBoardRaw } from '@entities/IBoardRaw.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import mongoose, { ClientSession, Types, UpdateWriteOpResult } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { IBoardCriteria } from '@criterias/IBoardCriteria.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.ts'
import { IUser } from '@entities/IUser.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { LifecycleDTO } from '../dtos/LifecycleDTO.ts'
import { WorkspaceService } from './WorkspaceService.ts'
import { BaseService } from './BaseService.ts'
import { IBoardPopulated } from '../interfaces/IBoardPopulated.ts'
import { IBoardCreatePayload } from '../interfaces/IBoardCreatePayload.ts'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.ts'
import { LimitService } from './LimitService.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { LexoRank } from 'lexorank'
import { BoardMoveDTO } from '../dtos/BoardMoveDTO.ts'

const MAX_RETRIES = 3

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
  protected workspaceService: WorkspaceService
  protected categoryService: CategoryService
  protected taskService: TaskService
  protected limitService: LimitService

  constructor(
    boardRepository: BoardRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    workspaceService: WorkspaceService,
    categoryService: CategoryService,
    taskService: TaskService,
    limitService: LimitService,
  ) {
    super(boardRepository)

    this.repository = boardRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.workspaceService = workspaceService
    this.categoryService = categoryService
    this.taskService = taskService
    this.limitService = limitService
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
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    /** LIMITS CHECK */
    await this.limitService.checkBoardsLimit(user, data.workspaceId, session)

    const boardPayload = await this.prepareBoardCreationPayload(data, user.id, session)

    /* CREATE */
    const newBoard = await this.repository.create(boardPayload, session)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: [newBoard],
        dependencies: [],
      },
      user.id,
      session,
    )

    const newBoardsPopulated = await this.getByCriteria(
      { id: newBoard.id.toString() },
      user.id,
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
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session),
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: BoardDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const uniqueWorkspaceIds = [...new Set(data.map((board) => board.workspaceId))]

    /** LIMITS CHECK */
    const incomingCounts: Record<string, number> = {}
    for (const board of data) {
      incomingCounts[board.workspaceId] = (incomingCounts[board.workspaceId] || 0) + 1
    }

    await this.limitService.checkBoardsLimitByWorkspaces(
      user,
      uniqueWorkspaceIds,
      incomingCounts,
      session,
    )

    const boardsPayload = await this.prepareBoardsCreationPayload(data, user.id, session, isDryRun)

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesAfter: boardsPayload,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    /* CREATE */
    const newBoards = await this.repository.createMany(boardsPayload, session)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: newBoards,
        dependencies: [],
      },
      user.id,
      session,
    )

    const newBoardsPopulated = await this.getByCriteria(
      { ids: newBoards.map((b) => b.id.toString()) },
      user.id,
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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (externalSession) {
      return this._executeCreateManyTransaction(data, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, user, session, isDryRun),
      )
    }
  }

  private async _executeEditTransaction(
    data: Omit<BoardEditDTO, 'id'>,
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
    }

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: projectProperties<IBoard>(updatedBoards, boardPayload),
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
    data: Omit<BoardEditDTO, 'id'>,
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
    isDryRun: boolean = false,
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
    const boardsBefore: (Partial<IBoard> & { id: Types.ObjectId })[] = []
    const movedBoardIds: string[] = []

    for (const dto of data) {
      const board = existingMap.get(dto.id)
      if (!board) continue

      const boardPayload = await this.prepareBoardEditManyPayload(dto, [board], isDryRun)

      const boardBefore = projectProperties<IBoard>([board], boardPayload)[0]

      boardsBefore.push(boardBefore)
      boardPayloads.push(boardPayload)

      const isMoving =
        dto.workspaceId !== undefined && board.workspace.toString() !== dto.workspaceId
      if (isMoving) {
        movedBoardIds.push(dto.id)
      }
    }

    if (isDryRun) {
      const boardsAfter = boardsBefore.map((b) => {
        const payload = boardPayloads.find((p) => p.id.toString() === b.id.toString())

        if (!payload) return b

        return {
          ...b,
          ...payload,
        }
      })

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore: boardsBefore,
          entitiesAfter: boardsAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        userId,
        session,
      )

      return {
        data: [],
        logId: log.id,
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
    }

    const projectedUpdatedBoards = updatedBoards.map(
      (b) =>
        projectProperties<IBoard>(
          [b],
          boardPayloads.find((p) => p.id.toString() === b.id.toString())!,
        )[0],
    )

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: projectedUpdatedBoards,
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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session, isDryRun),
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<null>> {
    const boardsToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (boardsToDelete.length === 0) {
      throw new NotFoundError('Доски для удаления не найдены.')
    }

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.DELETE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsToDelete,
        status,
        dependencies: [],
      },
      userId,
      session,
    )

    if (isDryRun) {
      return {
        data: null,
        logId: log.id,
      }
    }

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
    ])

    return {
      data: null,
      logId: log.id,
    }
  }

  public async delete(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<null>> {
    const userId = user.id

    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session, isDryRun),
      )
    }
  }

  private async _executeLifecycleTransaction(
    criteria: IBoardCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
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

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const entitiesBefore = projectProperties<IBoard>(boardsToProcess, data)
    const entitiesAfter = entitiesBefore.map((b) => ({ ...b, ...data }))

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: entitiesBefore,
        entitiesAfter: entitiesAfter,
        status,
        dependencies: [],
      },
      userId,
      session,
    )

    if (isDryRun) {
      return {
        data: [],
        logId: log.id,
      }
    }

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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, userId, session, isDryRun),
      )
    }
  }

  public async recover(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, userId, session, isDryRun),
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const dependencies: Types.ObjectId[] = []

    const boardsToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: isDryRun ? '-createdAt -updatedAt' : '+embeddings -createdAt -updatedAt',
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

    const uniqueWorkspaceIds = [...new Set(boardsToClone.map((b) => b.workspace.toString()))]
    const allBoardsInWorkspaces = await this.repository.findByCriteria(
      { workspaceIds: uniqueWorkspaceIds },
      session,
      { projection: 'rank workspace' },
      userId,
    )

    const transformedBoards: Omit<IBoard, 'id'>[] = []

    for (const [workspaceId, boards] of boardsGroupedByWorkspace) {
      const workspaceBoards = allBoardsInWorkspaces.filter(
        (b) => b.workspace.toString() === workspaceId,
      )

      const lastBoard = workspaceBoards.sort((a, b) => (a.rank > b.rank ? -1 : 1))[0]
      let lastRank = LexoRank.middle()

      if (lastBoard) {
        lastRank = LexoRank.parse(lastBoard.rank)
      }

      for (const board of boards) {
        const newRank = lastRank.genNext()

        const cleanBoard = {
          ...board,
          id: isDryRun ? board.id : undefined,
          rank: newRank.toString(),
        }

        lastRank = newRank

        transformedBoards.push(cleanBoard)
      }
    }

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CLONE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesAfter: transformedBoards,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        userId,
        session,
      )

      return {
        data: [],
        logId: log.id,
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

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CLONE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: clonedBoards,
        dependencies,
      },
      userId,
      session,
    )

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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCloneTransaction(criteria, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, userId, session, isDryRun),
      )
    }
  }

  public async move(
    dto: BoardMoveDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (externalSession) {
      return this._executeMoveTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveTransaction(
    dto: BoardMoveDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const { beforeBoardId, afterBoardId, id, newWorkspaceId } = dto

    const criteria: IBoardCriteria = {
      ids: [id, beforeBoardId, afterBoardId].filter((id): id is string => !!id),
    }

    const updateData: SafeUpdateData<IBoard> = {}

    const boards = await this.repository.findByCriteria(criteria, session, undefined, user.id)
    const board = boards.find((t) => t.id.toString() === id)
    const beforeBoard = boards.find((t) => t.id.toString() === beforeBoardId)
    const afterBoard = boards.find((t) => t.id.toString() === afterBoardId)

    if (!board) {
      throw new NotFoundError('Доска для перемещения не найдена.')
    }
    if (beforeBoardId && !beforeBoard) {
      throw new NotFoundError('Доска перед указанной не найдена.')
    }
    if (afterBoardId && !afterBoard) {
      throw new NotFoundError('Доска после указанной не найдена.')
    }

    if (newWorkspaceId) {
      const workspace = await this.workspaceService.getByCriteria(
        { id: newWorkspaceId },
        user.id,
        session,
      )

      if (!workspace.length) {
        throw new NotFoundError('Рабочее пространство для перемещения не найдено.')
      }
    }

    let newRank = LexoRank.middle()

    if (beforeBoard && afterBoard) {
      const beforeRank = LexoRank.parse(beforeBoard.rank)
      const afterRank = LexoRank.parse(afterBoard.rank)

      newRank = beforeRank.between(afterRank)
    } else if (beforeBoard) {
      const beforeRank = LexoRank.parse(beforeBoard.rank)

      newRank = beforeRank.genPrev()
    } else if (afterBoard) {
      const afterRank = LexoRank.parse(afterBoard.rank)

      newRank = afterRank.genNext()
    } else {
      newRank = LexoRank.middle()
    }

    updateData.rank = newRank.toString()

    if (newWorkspaceId) {
      updateData.workspace = new Types.ObjectId(newWorkspaceId)
    } else if (beforeBoard && beforeBoard.workspace.toString() !== board.workspace.toString()) {
      updateData.workspace = beforeBoard.workspace
    } else if (afterBoard && afterBoard.workspace.toString() !== board.workspace.toString()) {
      updateData.workspace = afterBoard.workspace
    }

    const boardsBefore = projectProperties<IBoard>([board], updateData)
    const boardsAfter = boardsBefore.map((b) => ({
      ...b,
      ...updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore: boardsBefore,
          entitiesAfter: boardsAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    await this.repository.updateManyByCriteria({ id }, updateData, session, user.id)

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: boardsAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedBoards = await this.getByCriteria({ id }, user.id, session)

    return {
      data: updatedBoards,
      logId: log.id,
    }
  }

  public async revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<any>> {
    const { operationType } = log

    const before = log.entitiesBefore as (Partial<IBoard> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<IBoard> & { id: Types.ObjectId })[]

    const idsBefore = before?.map((e) => e.id?.toString()) || []
    const idsAfter = after?.map((e) => e.id?.toString()) || []

    switch (operationType) {
      case OperationTypesEnum.CREATE:
      case OperationTypesEnum.CLONE: {
        return await this.delete({ ids: idsAfter }, user, session, isDryRun)
      }

      case OperationTypesEnum.UPDATE: {
        const payload = before.map((e) => ({
          ...e,
          id: e.id?.toString(),
        }))

        return await this.editMany(payload, user, session, isDryRun)
      }

      case OperationTypesEnum.ARCHIVE: {
        return await this.recover({ ids: idsBefore }, user, session, isDryRun)
      }

      case OperationTypesEnum.RECOVER: {
        return await this.archive({ ids: idsBefore }, user, session, isDryRun)
      }

      default:
        throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
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

    const criteria = { workspaceIds, isDeleted: false, isDeletedExternal: false }

    const sourceBoards = await this.repository.findByCriteria(criteria, session, undefined, userId)

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
        id: undefined,
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

    let boardRank = LexoRank.middle().toString()

    /* RANKING */
    const lastBoardsInWorkspace = await this.repository.findByCriteria(
      { workspaceId: data.workspaceId },
      session,
      { sort: { rank: -1 }, limit: 1 },
      userId,
    )
    if (lastBoardsInWorkspace.length > 0) {
      const lastBoard = lastBoardsInWorkspace[0]
      const lastRank = LexoRank.parse(lastBoard.rank)

      boardRank = lastRank.genNext().toString()
    }

    const boardPayload: IBoardCreatePayload = {
      name: boardName,
      workspace: Types.ObjectId.createFromHexString(data.workspaceId),
      rank: boardRank,
      embeddings,
      userId,
    }

    return boardPayload
  }

  private async prepareBoardsCreationPayload(
    data: BoardDTO[],
    userId: Types.ObjectId,
    session?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IBoardCreatePayload[]> {
    const boardsPayloads: IBoardCreatePayload[] = []
    const boardsGroupedByWorkspace: { [key: string]: BoardDTO[] } = {}
    const uniqueWorkspaceIds = Array.from(
      new Set(data.map((board) => new Types.ObjectId(board.workspaceId))),
    )

    data.forEach((board) => {
      const wsId = board.workspaceId
      if (!boardsGroupedByWorkspace[wsId]) {
        boardsGroupedByWorkspace[wsId] = []
      }

      boardsGroupedByWorkspace[wsId].push(board)
    })

    const embeddingsMap: { [key: string]: number[] } = {}

    if (!isDryRun) {
      const boardNames = Array.from(new Set(data.map((board) => board.name.trim())))
      const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(boardNames)
      boardNames.forEach((name, index) => {
        embeddingsMap[name] = embeddingsArray[index]
      })
    }

    const lastRanksByWorkspaces = await this.repository.getLastRanksByParents(
      uniqueWorkspaceIds,
      'workspace',
      userId,
      session,
    )

    for (const [wsId, boards] of Object.entries(boardsGroupedByWorkspace)) {
      let lastRank = LexoRank.middle()

      const lastRankData = lastRanksByWorkspaces.find((r) => r.parentId.toString() === wsId)
      if (lastRankData) {
        lastRank = LexoRank.parse(lastRankData.rank)
      }

      for (const board of boards) {
        const boardName = board.name.trim()
        const newRank = lastRank.genNext()

        boardsPayloads.push({
          id: board.id,
          name: boardName,
          workspace: new Types.ObjectId(board.workspaceId),
          rank: newRank.toString(),
          embeddings: embeddingsMap[boardName],
          userId,
        })

        lastRank = newRank
      }
    }

    return boardsPayloads
  }

  private async _prepareMainEditFields(
    data: Omit<BoardEditDTO, 'id'>,
    boardPayload: SafeUpdateData<IBoard>,
    boardsToUpdate: IBoard[],
    isDryRun: boolean = false,
  ) {
    if (data.workspaceId) {
      boardPayload.workspace = Types.ObjectId.createFromHexString(data.workspaceId)
    }

    if (!isDryRun && data.name && boardsToUpdate.length > 0) {
      const needEmbeddingsUpdate = boardsToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const boardName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(boardName)

        boardPayload.embeddings = embeddings
      }
    }
  }

  private async prepareBoardEditPayload(
    data: Omit<BoardEditDTO, 'id'>,
    boardsToUpdate: IBoard[],
  ): Promise<SafeUpdateData<IBoard>> {
    const boardPayload: SafeUpdateData<IBoard> = {
      ...data,
    }

    await this._prepareMainEditFields(data, boardPayload, boardsToUpdate)

    return boardPayload
  }

  private async prepareBoardEditManyPayload(
    data: BoardEditDTO,
    boardsToUpdate: IBoard[],
    isDryRun: boolean = false,
  ): Promise<SingleUpdateDTO<SafeUpdateData<IBoard>>> {
    const { id, ...rest } = data

    const boardPayload: SingleUpdateDTO<SafeUpdateData<IBoard>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    await this._prepareMainEditFields(rest, boardPayload, boardsToUpdate, isDryRun)

    return boardPayload
  }

  public async getBoardsCountByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(workspaceIds, 'workspace', userId, session)
  }
}
