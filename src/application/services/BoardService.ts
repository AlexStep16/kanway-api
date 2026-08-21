import { IBoard } from '@entities/IBoard.js'
import { IBoardRaw } from '@entities/IBoardRaw.js'
import BoardRepository from '@repositories/BoardRepository.js'
import { BoardDTO } from '@/application/dtos/BoardDTO.js'
import mongoose, { ClientSession, Types, UpdateWriteOpResult } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.js'
import { IBoardCriteria } from '@criterias/IBoardCriteria.js'
import { OperationLogService } from '@application/services/OperationLogService.js'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.js'
import { BoardEditDTO } from '@dtos/BoardEditDTO.js'
import { ColumnService } from '@application/services/ColumnService.js'
import { NotFoundError } from '@errors/NotFound.js'
import { TaskService } from '@application/services/TaskService.js'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.js'
import { IUser } from '@entities/IUser.js'
import { projectProperties } from '@/utils/projectProperties.js'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'
import { IOperationLog } from '@/domain/entities/IOperationLog.js'
import { AppError } from '@/domain/errors/AppError.js'
import { LifecycleDTO } from '../dtos/LifecycleDTO.js'
import { WorkspaceService } from './WorkspaceService.js'
import { BaseService } from './BaseService.js'
import { IBoardPopulated } from '../interfaces/IBoardPopulated.js'
import { IBoardCreatePayload } from '../interfaces/IBoardCreatePayload.js'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.js'
import { LimitService } from './LimitService.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'
import { LexoRank } from 'lexorank'
import { BoardMoveDTO } from '../dtos/BoardMoveDTO.js'
import { BoardMoveManyDTO } from '../dtos/BoardMoveManyDTO.js'
import { BoardReorderDTO } from '../dtos/BoardReorderDTO.js'
import { OutboxEventService } from './OutboxEventService.js'
import { OutboxEventTypeEnum } from '@/domain/enums/OutboxEventTypeEnum.js'

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
  protected columnService: ColumnService
  protected taskService: TaskService
  protected limitService: LimitService
  protected outboxEventService: OutboxEventService

  constructor(
    boardRepository: BoardRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    workspaceService: WorkspaceService,
    columnService: ColumnService,
    taskService: TaskService,
    limitService: LimitService,
    outboxEventService: OutboxEventService,
  ) {
    super(boardRepository)

    this.repository = boardRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.workspaceService = workspaceService
    this.columnService = columnService
    this.taskService = taskService
    this.limitService = limitService
    this.outboxEventService = outboxEventService
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
      'Произошла ошибка при выполнении операции после максимального количества попыток',
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

    /* EMBEDDINGS */
    await this.outboxEventService.create(
      {
        type: OutboxEventTypeEnum.GENERATE_BOARD_EMBEDDINGS,
        payload: {
          boardIds: [newBoard.id.toString()],
          userId: user.id,
        },
      },
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

  private async _checkBoardsLimitByWorkspaces(
    data: { workspaceId: string }[],
    user: IUser,
    session: ClientSession,
  ) {
    if (data.length === 0) return

    const uniqueWorkspaceIds = [...new Set(data.map((board) => board.workspaceId))]

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
  }

  private async _executeCreateManyTransaction(
    data: BoardDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    /** LIMITS CHECK */
    await this._checkBoardsLimitByWorkspaces(data, user, session)

    const boardsPayload = await this.prepareBoardsCreationPayload(data, user.id, session)

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

    /* EMBEDDINGS */
    await this.outboxEventService.create(
      {
        type: OutboxEventTypeEnum.GENERATE_BOARD_EMBEDDINGS,
        payload: {
          boardIds: newBoards.map((b) => b.id.toString()),
          userId: user.id,
        },
      },
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
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardsToUpdate: IBoard[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
    )

    if (boardsToUpdate.length === 0) throw new NotFoundError('Доски для редактирования не найдены.')

    const boardPayload = this.prepareBoardEditPayload(data)
    const boardsBefore = projectProperties<IBoard>(boardsToUpdate, boardPayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      boardPayload,
      session,
      user.id,
    )

    if (updateManyResult.modifiedCount === 0) throw new AppError('Не удалось обновить доски', 500)

    const sideEffects: Promise<any>[] = []

    /* MOVE */
    const boardsToMove = boardsToUpdate.filter(
      (b) => data.workspaceId !== undefined && b.workspace.toString() !== data.workspaceId,
    )

    if (boardsToMove.length > 0) {
      const boardIds = boardsToMove.map((b) => b.id.toString())

      const affectedColumnsPromise = this.columnService.getByCriteria(
        { boardIds },
        user.id,
        session,
        { projection: { _id: 1 } },
      )
      const affectedTasksPromise = this.taskService.getByCriteria({ boardIds }, user.id, session, {
        projection: { _id: 1 },
      })

      const [affectedColumns, affectedTasks] = await Promise.all([
        affectedColumnsPromise,
        affectedTasksPromise,
      ])

      if (affectedColumns.length > 0) {
        sideEffects.push(
          this.columnService.moveColumnsByBoards(
            affectedColumns.map((c) => c.id.toString()),
            user,
            session,
          ),
        )
      }

      if (affectedTasks.length > 0) {
        sideEffects.push(
          this.taskService.moveTasksByBoards(
            affectedTasks.map((t) => t.id.toString()),
            user,
            session,
          ),
        )
      }

      await this.rerankBoards(boardIds, user.id, session)
    }

    const updatedBoards = await this.repository.findByCriteria<IBoard>(
      criteria,
      session,
      undefined,
      user.id,
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: projectProperties<IBoard>(updatedBoards, boardPayload),
        dependencies: [],
      },
      user.id,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedBoardsPopulated = await this.getByCriteria(criteria, user.id, session)

    /* GENERATE EMBEDDINGS */
    const boardsIdToEditEmbeddings = this.getBoardsIdToEditEmbeddings(data, boardsToUpdate)

    await this.outboxEventService.create(
      {
        type: OutboxEventTypeEnum.GENERATE_BOARD_EMBEDDINGS,
        payload: {
          boardIds: boardsIdToEditEmbeddings,
          userId: user.id,
        },
      },
      session,
    )

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
    if (externalSession) {
      return this._executeEditTransaction(data, criteria, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, user, session),
      )
    }
  }

  private async _executeEditManyTransaction(
    data: BoardEditDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardIds = data.map((d) => d.id)

    const existingBoards = await this.repository.findByCriteria(
      { ids: boardIds },
      session,
      undefined,
      user.id,
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

      const boardPayload = this.prepareBoardEditManyPayload(dto)

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
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    const updatedBoardsResult = await this.repository.bulkUpdate(boardPayloads, user.id, session)

    if (!updatedBoardsResult || updatedBoardsResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить доски', 500)
    }

    const sideEffects: Promise<any>[] = []

    /** MOVE */
    if (movedBoardIds.length > 0) {
      const affectedColumnsPromise = this.columnService.getByCriteria(
        { boardIds: movedBoardIds },
        user.id,
        session,
        { projection: { _id: 1 } },
      )
      const affectedTasksPromise = this.taskService.getByCriteria(
        { boardIds: movedBoardIds },
        user.id,
        session,
        { projection: { _id: 1 } },
      )

      const [affectedColumns, affectedTasks] = await Promise.all([
        affectedColumnsPromise,
        affectedTasksPromise,
      ])

      if (affectedColumns.length > 0) {
        sideEffects.push(
          this.columnService.moveColumnsByBoards(
            affectedColumns.map((c) => c.id.toString()),
            user,
            session,
          ),
        )
      }

      if (affectedTasks.length > 0) {
        sideEffects.push(
          this.taskService.moveTasksByBoards(
            affectedTasks.map((t) => t.id.toString()),
            user,
            session,
          ),
        )
      }

      await this.rerankBoards(movedBoardIds, user.id, session)
    }

    const updatedBoards = await this.repository.findByCriteria(
      { ids: boardPayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      user.id,
    )

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
      user.id,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    const updatedBoardsPopulated = await this.getByCriteria({ ids: boardIds }, user.id, session)

    /* GENERATE EMBEDDINGS */
    const boardsIdToEditEmbeddings = this.getBoardsIdToEditManyEmbeddings(data, existingBoards)

    await this.outboxEventService.create(
      {
        type: OutboxEventTypeEnum.GENERATE_BOARD_EMBEDDINGS,
        payload: {
          boardIds: boardsIdToEditEmbeddings,
          userId: user.id,
        },
      },
      session,
    )

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
    if (externalSession) {
      return this._executeEditManyTransaction(data, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, user, session, isDryRun),
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
      this.columnService.deleteColumnsByCriteria(
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
    user: IUser,
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
      user.id,
    )

    const boardsCriteria = { boardIds: boardsToProcess.map((b) => b.id.toString()) }

    if (boardsToProcess.length === 0) throw new NotFoundError('Доски не найдены.')

    if (isRecover) {
      await this._checkBoardsLimitByWorkspaces(
        boardsToProcess.map((b) => ({ workspaceId: b.workspace.toString() })),
        user,
        session,
      )
    }

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
      user.id,
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
        user.id,
        session,
      ),
      this.columnService.updateLifecycleColumnsByCriteria(
        boardsCriteria,
        childrenData,
        user.id,
        session,
      ),

      /* PROCESS BOARDS */
      this.repository.updateManyByCriteria(criteria, data, session, user.id),
    ])

    const updatedBoardsPopulated = await this.getByCriteria(
      { ids: entitiesAfter.map((b) => b.id.toString()) },
      user.id,
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
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, user, session, isDryRun),
      )
    }
  }

  public async recover(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, user, session, isDryRun),
      )
    }
  }

  public async moveMany(
    dto: BoardMoveManyDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (externalSession) {
      return this._executeMoveManyTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveManyTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveManyTransaction(
    dto: BoardMoveManyDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const { ids, beforeBoardId, afterBoardId, newWorkspaceId, toStart, toEnd } = dto

    const uniqueBoardIds = [...new Set(ids)]
    if (uniqueBoardIds.length === 0) {
      throw new NotFoundError('Доски не найдены.')
    }

    if (toStart && toEnd) {
      throw new AppError('Нельзя переместить доски одновременно в начало и в конец', 400)
    }

    if ((toStart || toEnd) && (beforeBoardId || afterBoardId)) {
      throw new AppError(
        'Нельзя одновременно использовать beforeBoardId/afterBoardId и toStart/toEnd',
        400,
      )
    }

    if (beforeBoardId && uniqueBoardIds.includes(beforeBoardId)) {
      throw new AppError('beforeBoardId не может быть среди перемещаемых досок', 400)
    }

    if (afterBoardId && uniqueBoardIds.includes(afterBoardId)) {
      throw new AppError('afterBoardId не может быть среди перемещаемых досок', 400)
    }

    const relatedBoardIds = [
      ...new Set([...uniqueBoardIds, beforeBoardId, afterBoardId].filter(Boolean)),
    ]
    const boards = await this.repository.findByCriteria(
      { ids: relatedBoardIds as string[] },
      session,
      undefined,
      user.id,
    )

    const boardsToMove = boards
      .filter((board) => uniqueBoardIds.includes(board.id.toString()))
      .sort((a, b) => a.rank.localeCompare(b.rank))

    if (boardsToMove.length !== uniqueBoardIds.length) {
      throw new NotFoundError('Доски не найдены.')
    }

    const beforeBoard = beforeBoardId ? boards.find((b) => b.id.toString() === beforeBoardId) : null
    const afterBoard = afterBoardId ? boards.find((b) => b.id.toString() === afterBoardId) : null

    if (beforeBoardId && !beforeBoard) {
      throw new NotFoundError('Опорная доска beforeBoardId не найдена.')
    }

    if (afterBoardId && !afterBoard) {
      throw new NotFoundError('Опорная доска afterBoardId не найдена.')
    }

    const moveWithinEachCurrentWorkspace =
      !newWorkspaceId && !beforeBoard && !afterBoard && (toStart || toEnd)

    // Типизация приведена к эталону (использует динамический тип из WorkspaceService)
    let targetWorkspace: Awaited<ReturnType<WorkspaceService['getByCriteria']>>[number] | null =
      null
    let targetWorkspaceId: string | null = null

    if (newWorkspaceId) {
      const [workspace] = await this.workspaceService.getByCriteria(
        { id: newWorkspaceId },
        user.id,
        session,
      )
      if (!workspace) throw new NotFoundError('Рабочее пространство не найдено.')

      targetWorkspace = workspace
      targetWorkspaceId = workspace.id.toString()
    } else if (beforeBoard || afterBoard) {
      const anchorBoard = beforeBoard ?? afterBoard

      if (!anchorBoard) {
        throw new AppError(
          'Не удалось определить целевое рабочее пространство для перемещения',
          400,
        )
      }

      const [workspace] = await this.workspaceService.getByCriteria(
        { id: anchorBoard.workspace.toString() },
        user.id,
        session,
      )

      if (!workspace) throw new NotFoundError('Рабочее пространство не найдено.')

      targetWorkspace = workspace
      targetWorkspaceId = workspace.id.toString()
    } else if (!moveWithinEachCurrentWorkspace) {
      targetWorkspaceId = boardsToMove[0].workspace.toString()

      const hasDifferentWorkspace = boardsToMove.some(
        (board) => board.workspace.toString() !== targetWorkspaceId,
      )

      if (hasDifferentWorkspace) {
        throw new AppError(
          'Для массового перемещения без newWorkspaceId все доски должны быть из одного рабочего пространства',
          400,
        )
      }
    } else {
      targetWorkspaceId = null
    }

    if (beforeBoard && beforeBoard.workspace.toString() !== targetWorkspaceId) {
      throw new AppError('beforeBoardId должен принадлежать целевому рабочему пространству', 400)
    }

    if (afterBoard && afterBoard.workspace.toString() !== targetWorkspaceId) {
      throw new AppError('afterBoardId должен принадлежать целевому рабочему пространству', 400)
    }

    let newRanks: string[] = []

    if (moveWithinEachCurrentWorkspace) {
      const updatesWithMetadata: Array<{
        board: IBoard
        updateData: SingleUpdateDTO<SafeUpdateData<IBoard>>
      }> = []

      const boardsByWorkspace = new Map<string, IBoard[]>()
      for (const board of boardsToMove) {
        const workspaceId = board.workspace.toString()
        const currentGroup = boardsByWorkspace.get(workspaceId) || []
        currentGroup.push(board)
        boardsByWorkspace.set(workspaceId, currentGroup)
      }

      for (const [workspaceId, workspaceBoards] of boardsByWorkspace.entries()) {
        if (toStart) {
          const firstBoardsInWorkspace = await this.repository.findByCriteria(
            { workspaceId },
            session,
            { sort: { rank: 1 }, limit: 1 },
            user.id,
          )

          let rankCursor =
            firstBoardsInWorkspace.length > 0
              ? LexoRank.parse(firstBoardsInWorkspace[0].rank)
              : LexoRank.middle()

          const boardRanks: string[] = []
          for (let i = 0; i < workspaceBoards.length; i++) {
            rankCursor =
              firstBoardsInWorkspace.length > 0 ? rankCursor.genPrev() : rankCursor.genNext()
            boardRanks.push(rankCursor.toString())
          }

          if (firstBoardsInWorkspace.length > 0) {
            boardRanks.reverse()
          }

          workspaceBoards.forEach((board, index) => {
            updatesWithMetadata.push({
              board,
              updateData: {
                id: board.id,
                rank: boardRanks[index],
              },
            })
          })
        } else {
          const lastRankData = await this.repository.getLastRanksByParents(
            [new Types.ObjectId(workspaceId)],
            'workspace',
            user.id,
            session,
          )

          let rankCursor = lastRankData.length
            ? LexoRank.parse(lastRankData[0].rank)
            : LexoRank.middle()

          workspaceBoards.forEach((board) => {
            rankCursor = rankCursor.genNext()
            updatesWithMetadata.push({
              board,
              updateData: {
                id: board.id,
                rank: rankCursor.toString(),
              },
            })
          })
        }
      }

      const entitiesBefore = updatesWithMetadata.map(
        ({ board, updateData }) => projectProperties<IBoard>([board], updateData)[0],
      )
      const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
        ...beforeEntity,
        ...updatesWithMetadata[index].updateData,
      }))

      if (isDryRun) {
        const log = await this.operationLogService.create(
          {
            operationType: OperationTypesEnum.UPDATE,
            collectionName: CollectionsEnum.BOARDS,
            entitiesBefore,
            entitiesAfter,
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

      const updateResult = await this.repository.bulkUpdate(
        updatesWithMetadata.map(({ updateData }) => updateData),
        user.id,
        session,
      )

      if (!updateResult || updateResult.modifiedCount === 0) {
        throw new AppError('Не удалось переместить доски', 500)
      }

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore,
          entitiesAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.SUCCESS,
        },
        user.id,
        session,
      )

      const updatedBoards = await this.getByCriteria(
        { ids: boardsToMove.map((board) => board.id.toString()) },
        user.id,
        session,
      )

      return {
        data: updatedBoards,
        logId: log.id,
      }
    }

    if (targetWorkspaceId === null) {
      throw new AppError('Не удалось определить целевую рабочую область для перемещения', 400)
    }

    if (toStart) {
      const firstBoardsInWorkspace = await this.repository.findByCriteria(
        { workspaceId: targetWorkspaceId },
        session,
        { sort: { rank: 1 }, limit: 1 },
        user.id,
      )

      if (firstBoardsInWorkspace.length > 0) {
        const generatedRanks: string[] = []
        let rankCursor = LexoRank.parse(firstBoardsInWorkspace[0].rank)

        for (let i = 0; i < boardsToMove.length; i++) {
          rankCursor = rankCursor.genPrev()
          generatedRanks.push(rankCursor.toString())
        }

        newRanks = generatedRanks.reverse()
      } else {
        let rankCursor = LexoRank.middle()
        for (let i = 0; i < boardsToMove.length; i++) {
          rankCursor = rankCursor.genNext()
          newRanks.push(rankCursor.toString())
        }
      }
    } else if (beforeBoard && afterBoard) {
      let left = LexoRank.parse(beforeBoard.rank)
      const right = LexoRank.parse(afterBoard.rank)

      for (let i = 0; i < boardsToMove.length; i++) {
        left = left.between(right)
        newRanks.push(left.toString())
      }
    } else if (beforeBoard) {
      const generatedRanks: string[] = []
      let rankCursor = LexoRank.parse(beforeBoard.rank)

      for (let i = 0; i < boardsToMove.length; i++) {
        rankCursor = rankCursor.genPrev()
        generatedRanks.push(rankCursor.toString())
      }

      newRanks = generatedRanks.reverse()
    } else if (afterBoard) {
      let rankCursor = LexoRank.parse(afterBoard.rank)

      for (let i = 0; i < boardsToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    } else {
      const lastRankData = await this.repository.getLastRanksByParents(
        [new Types.ObjectId(targetWorkspaceId)],
        'workspace',
        user.id,
        session,
      )

      let rankCursor = lastRankData.length
        ? LexoRank.parse(lastRankData[0].rank)
        : LexoRank.middle()

      for (let i = 0; i < boardsToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    }

    const updatesWithMetadata = boardsToMove.map((board, index) => {
      const updateData: SingleUpdateDTO<SafeUpdateData<IBoard>> = {
        id: board.id,
        rank: newRanks[index],
      }

      if (targetWorkspace) {
        updateData.workspace = targetWorkspace.id
      }

      return {
        board,
        updateData,
      }
    })

    if (targetWorkspace) {
      const boardsWithNewWorkspace = updatesWithMetadata
        .filter(({ board }) => board.workspace.toString() !== targetWorkspace!.id.toString())
        .map(() => ({ workspaceId: targetWorkspace!.id.toString() }))

      await this._checkBoardsLimitByWorkspaces(boardsWithNewWorkspace, user, session)
    }

    const entitiesBefore = updatesWithMetadata.map(
      ({ board, updateData }) => projectProperties<IBoard>([board], updateData)[0],
    )
    const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
      ...beforeEntity,
      ...updatesWithMetadata[index].updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore,
          entitiesAfter,
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

    const updateResult = await this.repository.bulkUpdate(
      updatesWithMetadata.map(({ updateData }) => updateData),
      user.id,
      session,
    )

    if (!updateResult || updateResult.modifiedCount === 0) {
      throw new AppError('Не удалось переместить доски', 500)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore,
        entitiesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedBoards = await this.getByCriteria(
      { ids: boardsToMove.map((board) => board.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedBoards,
      logId: log.id,
    }
  }

  private async _executeReorderTransaction(
    dto: BoardReorderDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const { ids, workspaceId } = dto

    const boards = await this.repository.findByCriteria({ ids }, session, undefined, user.id)

    const isAllFromSameWorkspace = boards.every(
      (board) => board.workspace.toString() === workspaceId,
    )

    if (!isAllFromSameWorkspace) {
      throw new AppError('Все доски должны принадлежать одному рабочему пространству', 400)
    }

    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<IBoard>>[] = []
    let currentRank = LexoRank.middle()

    const boardsMap = new Map(boards.map((b) => [b.id.toString(), b]))

    ids.forEach((boardId, index) => {
      bulkUpdates.push({
        id: new Types.ObjectId(boardId),
        rank: currentRank.toString(),
      })

      if (index < ids.length - 1) {
        currentRank = currentRank.genNext()
      }
    })

    const updatesWithMetadata = bulkUpdates.map((updateData) => {
      const board = boardsMap.get(updateData.id.toString())!
      return { board, updateData }
    })

    const entitiesBefore = updatesWithMetadata.map(
      ({ board, updateData }) => projectProperties<IBoard>([board], updateData)[0],
    )
    const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
      ...beforeEntity,
      ...updatesWithMetadata[index].updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore,
          entitiesAfter,
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

    const updateResult = await this.repository.bulkUpdate(bulkUpdates, user.id, session)

    if (!updateResult || updateResult.modifiedCount === 0) {
      throw new AppError('Не удалось переупорядочить доски', 500)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore,
        entitiesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedBoards = await this.getByCriteria({ ids }, user.id, session)

    return {
      data: updatedBoards,
      logId: log.id,
    }
  }

  public async reorder(
    dto: BoardReorderDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (externalSession) {
      return this._executeReorderTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeReorderTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: IBoardCriteria,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const dependencies: Types.ObjectId[] = []

    const boardsToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: isDryRun ? '-createdAt -updatedAt' : '+embeddings -createdAt -updatedAt',
      },
      user.id,
    )

    if (boardsToClone.length === 0) throw new NotFoundError('Доски для клонирования не найдены.')

    /** LIMITS CHECK */
    await this._checkBoardsLimitByWorkspaces(
      boardsToClone.map((b) => ({ workspaceId: b.workspace.toString() })),
      user,
      session,
    )

    const boardsGroupedByWorkspace: Map<string, IBoard[]> = new Map()

    boardsToClone.forEach((board) => {
      const workspaceId = board.workspace.toString()

      if (!boardsGroupedByWorkspace.has(workspaceId)) {
        boardsGroupedByWorkspace.set(workspaceId, [])
      }

      boardsGroupedByWorkspace.get(workspaceId)!.push(board)
    })

    const uniqueWorkspaceIds = [...new Set(boardsToClone.map((b) => b.workspace))]
    const lastRanksArray = await this.repository.getLastRanksByParents(
      uniqueWorkspaceIds,
      'workspace',
      user.id,
      session,
    )
    const lastRankMap = new Map<string, string>()
    lastRanksArray.forEach((r) => {
      lastRankMap.set(r.parentId.toString(), r.rank)
    })

    const transformedBoards: IBoardCreatePayload[] = []

    for (const [workspaceId, boards] of boardsGroupedByWorkspace) {
      for (let i = 0; i < boards.length; i++) {
        const board = boards[i]
        const id = tempIds[i] || undefined

        const lastRankInMap = lastRankMap.get(workspaceId)
        let nextRank: string

        if (lastRankInMap) {
          nextRank = LexoRank.parse(lastRankInMap).genNext().toString()
        } else {
          nextRank = LexoRank.middle().toString()
        }

        lastRankMap.set(workspaceId, nextRank)

        const cleanBoard = {
          ...board,
          id: isDryRun ? board.id.toString() : id,
          name: `${board.name} (Копия)`,
          rank: nextRank,
        }

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
        user.id,
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

    const cloneColumnsResult = await this.columnService.cloneColumnsByBoards(
      boardIdsMap,
      user.id,
      session,
    )

    if (cloneColumnsResult.logId) dependencies.push(cloneColumnsResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CLONE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: clonedBoards,
        dependencies,
      },
      user.id,
      session,
    )

    const clonedBoardsPopulated = await this.getByCriteria(
      { ids: clonedBoards.map((b) => b.id.toString()) },
      user.id,
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
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (externalSession) {
      return this._executeCloneTransaction(criteria, user, externalSession, isDryRun, tempIds)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, user, session, isDryRun, tempIds),
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
    const { beforeId, afterId, id, newWorkspaceId } = dto

    const boardIds = [id, beforeId, afterId].filter(Boolean) as string[]
    const boards = await this.repository.findByCriteria(
      { ids: boardIds },
      session,
      undefined,
      user.id,
    )

    const board = boards.find((t) => t.id.toString() === id)
    const beforeBoard = beforeId ? boards.find((t) => t.id.toString() === beforeId) : null
    const afterBoard = afterId ? boards.find((t) => t.id.toString() === afterId) : null

    if (!board) throw new NotFoundError('Доска не найдена.')

    let newRank: LexoRank

    if (beforeBoard && afterBoard) {
      newRank = LexoRank.parse(beforeBoard.rank).between(LexoRank.parse(afterBoard.rank))
    } else if (beforeBoard) {
      newRank = LexoRank.parse(beforeBoard.rank).genPrev()
    } else if (afterBoard) {
      newRank = LexoRank.parse(afterBoard.rank).genNext()
    } else {
      if (newWorkspaceId) {
        const lastRankData = await this.repository.getLastRanksByParents(
          [new Types.ObjectId(newWorkspaceId)],
          'workspace',
          user.id,
          session,
        )
        newRank = lastRankData.length
          ? LexoRank.parse(lastRankData[0].rank).genNext()
          : LexoRank.middle()
      } else {
        newRank = LexoRank.middle()
      }
    }

    const updateData: SafeUpdateData<IBoard> = {
      rank: newRank.toString(),
    }

    if (newWorkspaceId) {
      const [workspace] = await this.workspaceService.getByCriteria(
        { id: newWorkspaceId },
        user.id,
        session,
      )
      if (!workspace) throw new NotFoundError('Рабочее пространство не найдено.')

      updateData.workspace = workspace.id
    }

    const boardsBefore = projectProperties<IBoard>([board], updateData)
    const boardsAfter = boardsBefore.map((t) => ({
      ...t,
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

  public async rerankBoards(boardIds: string[], userId: Types.ObjectId, session: ClientSession) {
    const boards = await this.repository.findByCriteria(
      { ids: boardIds },
      session,
      {
        sort: { rank: 1 },
      },
      userId,
    )
    if (!boards.length) return

    const workspaceIds = [...new Set(boards.map((b) => b.workspace))]

    const [workspaces, lastRanksByWorkspaces] = await Promise.all([
      this.workspaceService.getByCriteria(
        { ids: workspaceIds.map((id) => id.toString()) },
        userId,
        session,
      ),
      this.repository.getLastRanksByParents(workspaceIds, 'workspace', userId, session),
    ])

    const lastRankMap = new Map<string, string>()

    lastRanksByWorkspaces.forEach((item) => {
      lastRankMap.set(item.parentId.toString(), item.rank)
    })

    const workspaceMap = new Map(workspaces.map((w) => [w.id.toString(), w]))
    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<IBoard>>[] = []

    for (const board of boards) {
      const wsId = board.workspace.toString()
      const workspace = workspaceMap.get(wsId)

      if (workspace) {
        const currentLastRank = lastRankMap.get(wsId)
        let newRank: string

        if (currentLastRank) {
          newRank = LexoRank.parse(currentLastRank).genNext().toString()
        } else {
          newRank = LexoRank.middle().toString()
        }

        lastRankMap.set(wsId, newRank)

        bulkUpdates.push({
          id: board.id,
          rank: newRank,
        })
      }
    }

    if (bulkUpdates.length > 0) {
      return await this.repository.bulkUpdate(bulkUpdates, userId, session)
    }

    return null
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
          'Не удалось найти данные рабочего пространства для клонирования доски',
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

    const columnsCloneResult = await this.columnService.cloneColumnsByBoards(
      boardIdsMap,
      userId,
      session,
    )

    if (columnsCloneResult.logId) dependencies.push(columnsCloneResult.logId)

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

    const embeddings: number[] = []

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
      isFavorite: data.isFavorite || false,
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
          isFavorite: board.isFavorite,
          workspace: new Types.ObjectId(board.workspaceId),
          rank: newRank.toString(),
          embeddings: [],
          userId,
        })

        lastRank = newRank
      }
    }

    return boardsPayloads
  }

  public async generateEmbeddingsForBoards(
    boardIds: string[],
    userId: Types.ObjectId,
  ): Promise<void> {
    const boards = await this.getByCriteria({ ids: boardIds }, userId)

    return this.scheduleEmbeddingsGeneration(boards, userId)
  }

  private getBoardsIdToEditEmbeddings(
    data: Omit<BoardEditDTO, 'id'>,
    boardsBeforeUpdate: IBoard[],
  ): string[] {
    if (!data.name) return []

    return boardsBeforeUpdate
      .filter((board) => board.name !== data.name)
      .map((board) => board.id.toString())
  }

  private getBoardsIdToEditManyEmbeddings(
    data: BoardEditDTO[],
    boardsBeforeUpdate: IBoard[],
  ): string[] {
    const originalBoardsMap = new Map(
      boardsBeforeUpdate.map((board) => [board.id.toString(), board]),
    )

    return data
      .filter((dto) => {
        if (dto.name === undefined) return false

        const originalBoard = originalBoardsMap.get(dto.id)
        if (!originalBoard) return false

        return originalBoard.name !== dto.name
      })
      .map((dto) => dto.id.toString())
  }

  private scheduleEmbeddingsGeneration(boards: IBoardPopulated[], userId: Types.ObjectId) {
    const boardsByName = new Map<string, Types.ObjectId[]>()

    for (const board of boards) {
      const boardName = board.name.trim()
      const ids = boardsByName.get(boardName) || []
      ids.push(board.id)
      boardsByName.set(boardName, ids)
    }

    void this.generateEmbeddings(boardsByName, userId).catch((error) => {
      console.error('Failed to generate board embeddings:', error)
    })
  }

  private async generateEmbeddings(
    boardsByName: Map<string, Types.ObjectId[]>,
    userId: Types.ObjectId,
  ) {
    const boardNames = Array.from(boardsByName.keys())
    if (boardNames.length === 0) return

    const embeddings = await this.embeddingService.getEmbeddingsForMultipleTexts(boardNames)
    const updates = embeddings.flatMap((embedding, index) => {
      const name = boardNames[index]!

      return (boardsByName.get(name) || []).map((id) => ({ id, name, embeddings: embedding }))
    })

    await this.repository.updateEmbeddings(updates, userId)
  }

  private _prepareMainEditFields(
    data: Omit<BoardEditDTO, 'id'>,
    boardPayload: SafeUpdateData<IBoard>,
  ) {
    if (data.workspaceId) {
      boardPayload.workspace = Types.ObjectId.createFromHexString(data.workspaceId)
    }
  }

  private prepareBoardEditPayload(data: Omit<BoardEditDTO, 'id'>): SafeUpdateData<IBoard> {
    const boardPayload: SafeUpdateData<IBoard> = {
      ...data,
    }

    this._prepareMainEditFields(data, boardPayload)

    return boardPayload
  }

  private prepareBoardEditManyPayload(data: BoardEditDTO): SingleUpdateDTO<SafeUpdateData<IBoard>> {
    const { id, ...rest } = data

    const boardPayload: SingleUpdateDTO<SafeUpdateData<IBoard>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    this._prepareMainEditFields(rest, boardPayload)

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
