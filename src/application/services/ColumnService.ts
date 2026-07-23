import { IColumnRaw } from '@entities/IColumnRaw.js'
import ColumnRepository from '@repositories/ColumnRepository.js'
import { ColumnDTO } from '@application/dtos/ColumnDTO.js'
import mongoose, { ClientSession, DeleteResult, Types, UpdateWriteOpResult } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.js'
import { IColumnCriteria } from '@criterias/IColumnCriteria.js'
import { OperationLogService } from '@application/services/OperationLogService.js'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.js'
import { ColumnEditDTO } from '@dtos/ColumnEditDTO.js'
import { NotFoundError } from '@errors/NotFound.js'
import { TaskService } from '@application/services/TaskService.js'
import { BoardService } from '@application/services/BoardService.js'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.js'
import { IColumn } from '@entities/IColumn.js'
import { IUser } from '@entities/IUser.js'
import { projectProperties } from '@/utils/projectProperties.js'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'
import { IOperationLog } from '@entities/IOperationLog.js'
import { AppError } from '@/domain/errors/AppError.js'
import { LifecycleDTO } from '@dtos/LifecycleDTO.js'
import { WorkspaceService } from '@application/services/WorkspaceService.js'
import { BaseService } from '@application/services/BaseService.js'
import { IColumnPopulated } from '@interfaces/IColumnPopulated.js'
import { IColumnCreatePayload } from '@interfaces/IColumnCreatePayload.js'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'
import { LexoRank } from 'lexorank'
import { ColumnMoveDTO } from '../dtos/ColumnMoveDTO.js'
import { LimitService } from './LimitService.js'
import { ColumnMoveManyDTO } from '../dtos/ColumnMoveManyDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { IBoardPopulated } from '../interfaces/IBoardPopulated.js'
import { ColumnReorderDTO } from '../dtos/ColumnReorderDTO.js'

const MAX_RETRIES = 3

export class ColumnService extends BaseService<
  IColumnRaw,
  IColumn,
  IColumnCriteria,
  IColumnPopulated,
  IColumnCreatePayload
> {
  protected repository: ColumnRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected workspaceService: WorkspaceService
  protected boardService: BoardService
  protected taskService: TaskService
  protected limitService: LimitService

  constructor(
    columnRepository: ColumnRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    workspaceService: WorkspaceService,
    boardService: BoardService,
    taskService: TaskService,
    limitService: LimitService,
  ) {
    super(columnRepository)

    this.repository = columnRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.workspaceService = workspaceService
    this.boardService = boardService
    this.taskService = taskService
    this.limitService = limitService
  }

  protected getPopulateOptions() {
    return [
      { path: 'board', select: 'name' },
      { path: 'workspace', select: 'name' },
    ]
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
    data: ColumnDTO,
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const columnBoards = await this.boardService.getByCriteria(
      { id: data.boardId },
      user.id,
      session,
    )

    if (columnBoards.length === 0) {
      throw new NotFoundError(ErrorMessages.BOARD_NOT_FOUND)
    }

    const columnBoard = columnBoards[0]

    /** LIMITS CHECK */
    await this.limitService.checkColumnsLimit(user, columnBoard.id.toString(), session)

    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const columnPayload = await this.prepareColumnCreationPayload(
      data,
      columnBoard,
      user.id,
      session,
    )

    /* CREATE */
    const newColumn = await this.repository.create(columnPayload, session)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesAfter: [newColumn],
        dependencies: [],
      },
      user.id,
      session,
    )

    const newColumnsPopulated = await this.getByCriteria(
      { id: newColumn.id.toString() },
      user.id,
      session,
    )

    newColumnsPopulated[0].tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

    return {
      data: newColumnsPopulated,
      logId: log.id,
    }
  }

  public async create(
    data: ColumnDTO,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      const result = await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session),
      )

      this.scheduleEmbeddingsGeneration(result.data, user.id)

      return result
    }
  }

  private async _executeCreateManyTransaction(
    data: ColumnDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const columnsBoardMap = await this._getColumnsBoardMap(data, user, session)
    const boardIds = Array.from(columnsBoardMap.values()).map((board) => board.id.toString())

    await this._checkColumnsLimitByBoards(boardIds, user, session)

    const columnsPayload = await this.prepareColumnsCreationPayload(
      data,
      columnsBoardMap,
      user.id,
      session,
    )

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.COLUMNS,
          entitiesAfter: columnsPayload,
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
    const newColumns = await this.repository.createMany(columnsPayload, session)

    const newColumnsPopulated = await this.getByCriteria(
      { ids: newColumns.map((t) => t.id.toString()) },
      user.id,
      session,
    )

    newColumnsPopulated.forEach((nc, index) => {
      nc.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity
    })

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesAfter: newColumns,
        dependencies: [],
      },
      user.id,
      session,
    )

    return {
      data: newColumnsPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: ColumnDTO[],
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeCreateManyTransaction(data, user, externalSession, isDryRun)
    } else {
      const result = await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, user, session, isDryRun),
      )

      if (!isDryRun) {
        this.scheduleEmbeddingsGeneration(result.data, user.id)
      }

      return result
    }
  }

  private async _getColumnsBoardMap(
    columns: Pick<ColumnEditDTO, 'boardId'>[],
    user: IUser,
    session: ClientSession,
  ): Promise<Map<string, IBoardPopulated>> {
    const filteredColumns = columns.filter((c) => c.boardId !== undefined)
    const boardIds = [...new Set(filteredColumns.map((t) => t.boardId!))]

    const boards = await this.boardService.getByCriteria({ ids: boardIds }, user.id, session)

    const boardMap = new Map<string, IBoardPopulated>()

    boards.forEach((b) => {
      boardMap.set(b.id.toString(), b)
    })

    const columnsBoardMap = new Map<string, IBoardPopulated>()

    filteredColumns.forEach((column) => {
      const board = boardMap.get(column.boardId!)

      if (board) {
        columnsBoardMap.set(column.boardId!, board)
      }
    })

    return columnsBoardMap
  }

  private async _checkColumnsLimitByBoards(
    boardIds: string[],
    user: IUser,
    session: ClientSession,
  ) {
    if (boardIds.length === 0) return

    const uniqueBoardIds = [...new Set(boardIds)]

    const incomingCounts: Record<string, number> = {}
    for (const boardId of boardIds) {
      incomingCounts[boardId] = (incomingCounts[boardId] || 0) + 1
    }

    await this.limitService.checkColumnsLimitByBoards(user, uniqueBoardIds, incomingCounts, session)
  }

  private async _executeEditTransaction(
    data: Omit<ColumnEditDTO, 'id'>,
    criteria: IColumnCriteria,
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const columnsToUpdate: IColumn[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
    )

    if (columnsToUpdate.length === 0)
      throw new NotFoundError('Колонки для редактирования не найдены.')

    const columnsBoardMap = await this._getColumnsBoardMap([data], user, session)

    const columnPayload = await this.prepareColumnEditPayload(
      data,
      columnsToUpdate,
      columnsBoardMap,
    )
    const columnsBefore = projectProperties<IColumn>(columnsToUpdate, columnPayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      columnPayload,
      session,
      user.id,
    )

    if (updateManyResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить колонки.', 500)

    const sideEffects: Promise<any>[] = []

    /* MOVE */
    const columnsToMove = columnsToUpdate.filter(
      (b) => data.boardId !== undefined && b.board.toString() !== data.boardId,
    )

    if (columnsToMove.length > 0) {
      await this.moveColumnsByBoards(
        columnsToMove.map((column) => column.id.toString()),
        user,
        session,
        true,
      )

      const affectedTasks = await this.taskService.getByCriteria(
        {
          columnIds: columnsToMove.map((c) => c.id.toString()),
        },
        user.id,
        session,
        { projection: { _id: 1 } },
      )

      sideEffects.push(
        this.taskService.moveTasksByColumns(
          affectedTasks.map((t) => t.id.toString()),
          user,
          session,
        ),
      )
    }

    const updatedColumns = await this.repository.findByCriteria<IColumn>(
      criteria,
      session,
      undefined,
      user.id,
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesBefore: columnsBefore,
        entitiesAfter: projectProperties(updatedColumns, columnPayload),
        dependencies: [],
      },
      user.id,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedColumnsPopulated = await this.getByCriteria(criteria, user.id, session)

    return {
      data: updatedColumnsPopulated,
      logId: log.id,
    }
  }

  public async edit(
    data: Omit<ColumnEditDTO, 'id'>,
    criteria: IColumnCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeEditTransaction(data, criteria, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, user, session),
      )
    }
  }

  private async _executeEditManyTransaction(
    data: ColumnEditDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const columnIds = data.map((d) => d.id)

    const existingColumns = await this.repository.findByCriteria(
      { ids: columnIds },
      session,
      undefined,
      user.id,
    )

    if (existingColumns.length === 0) {
      throw new NotFoundError('Колонки для обновления не найдены.')
    }

    const existingMap = new Map(existingColumns.map((c) => [c.id.toString(), c]))

    const columnPayloads: SingleUpdateDTO<SafeUpdateData<IColumn>>[] = []
    const columnsBefore: (Partial<IColumn> & { id: Types.ObjectId })[] = []
    const movedColumnIds: string[] = []

    // Need to fill the columnPayload with correct board/workspace ids in case of moving
    const columnsWithNewBoardIds = data.filter((d) => {
      const column = existingMap.get(d.id)
      return column && d.boardId !== undefined && column.board.toString() !== d.boardId
    })
    const columnsBoardMap = await this._getColumnsBoardMap(columnsWithNewBoardIds, user, session)

    for (const dto of data) {
      const column = existingMap.get(dto.id)
      if (!column) continue

      const columnPayload = await this.prepareColumnEditManyPayload(
        dto,
        [column],
        columnsBoardMap,
        isDryRun,
      )

      const columnBefore = projectProperties<IColumn>([column], columnPayload)[0]

      columnsBefore.push(columnBefore)
      columnPayloads.push(columnPayload)

      const isMoving = dto.boardId !== undefined && column.board.toString() !== dto.boardId
      if (isMoving) {
        movedColumnIds.push(dto.id)
      }
    }

    if (isDryRun) {
      const columnsAfter = columnsBefore.map((c) => {
        const payload = columnPayloads.find((p) => p.id.toString() === c.id.toString())

        if (!payload) return c

        return {
          ...c,
          ...payload,
        }
      })

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.COLUMNS,
          entitiesBefore: columnsBefore,
          entitiesAfter: columnsAfter,
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

    const updatedColumnsResult = await this.repository.bulkUpdate(columnPayloads, user.id, session)

    if (!updatedColumnsResult || updatedColumnsResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить колонки.', 500)
    }

    const sideEffects: Promise<any>[] = []

    /** MOVE */
    if (movedColumnIds.length > 0) {
      await this.moveColumnsByBoards(movedColumnIds, user, session, true)

      const affectedTasks = await this.taskService.getByCriteria(
        { columnIds: movedColumnIds },
        user.id,
        session,
        { projection: { _id: 1 } },
      )

      if (affectedTasks.length > 0) {
        sideEffects.push(
          this.taskService.moveTasksByColumns(
            affectedTasks.map((t) => t.id.toString()),
            user,
            session,
          ),
        )
      }
    }

    const updatedColumns = await this.repository.findByCriteria(
      { ids: columnPayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      user.id,
    )

    const projectedUpdatedColumns = updatedColumns.map(
      (c) =>
        projectProperties<IColumn>(
          [c],
          columnPayloads.find((p) => p.id.toString() === c.id.toString())!,
        )[0],
    )

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesBefore: columnsBefore,
        entitiesAfter: projectedUpdatedColumns,
        dependencies: [],
      },
      user.id,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    const updatedColumnsPopulated = await this.getByCriteria({ ids: columnIds }, user.id, session)

    return {
      data: updatedColumnsPopulated,
      logId: log.id,
    }
  }

  public async editMany(
    data: ColumnEditDTO[],
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeEditManyTransaction(data, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, user, session, isDryRun),
      )
    }
  }

  public async moveColumnsByBoards(
    columnIds: string[],
    user: IUser,
    session: ClientSession,
    isRerank = false,
  ) {
    const columns = await this.repository.findByCriteria(
      { ids: columnIds },
      session,
      {
        sort: { rank: 1 },
      },
      user.id,
    )
    if (!columns.length) return

    const boardIds = [...new Set(columns.map((c) => c.board))]

    const [boards, lastRanksArray] = await Promise.all([
      this.boardService.getByCriteria(
        { ids: boardIds.map((id) => id.toString()) },
        user.id,
        session,
      ),
      this.repository.getLastRanksByParents(boardIds, 'board', user.id, session),
    ])

    const boardMap = new Map(boards.map((b) => [b.id.toString(), b]))

    const lastRankMap = new Map<string, string>()
    lastRanksArray.forEach((r) => {
      lastRankMap.set(r.parentId.toString(), r.rank)
    })

    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<IColumn>>[] = []
    const columnsWithNewBoard: { boardId: string }[] = []

    for (const column of columns) {
      const boardIdStr = column.board.toString()
      const board = boardMap.get(boardIdStr)

      if (!board) continue

      const update: SingleUpdateDTO<SafeUpdateData<IColumn>> = {
        id: column.id,
        board: board.id,
        workspace: board.workspace.id,
      }

      if (column.board.toString() !== board.id.toString()) {
        columnsWithNewBoard.push({ boardId: board.id.toString() })
      }

      if (isRerank) {
        const currentLastRank = lastRankMap.get(boardIdStr)
        let nextRank: string

        if (currentLastRank) {
          nextRank = LexoRank.parse(currentLastRank).genNext().toString()
        } else {
          nextRank = LexoRank.middle().toString()
        }

        update.rank = nextRank

        lastRankMap.set(boardIdStr, nextRank)
      }

      bulkUpdates.push(update)
    }

    if (bulkUpdates.length > 0) {
      const boardIds = columnsWithNewBoard.map((c) => c.boardId)
      await this._checkColumnsLimitByBoards(boardIds, user, session)

      return await this.repository.bulkUpdate(bulkUpdates, user.id, session)
    }

    return null
  }

  private async _executeDeleteTransaction(
    criteria: IColumnCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<DeleteResult | null>> {
    const columnsToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (columnsToDelete.length === 0) {
      throw new NotFoundError('Колонки для удаления не найдены.')
    }

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.DELETE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesBefore: columnsToDelete,
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

    const deleteResult = await this.repository.deleteMany(criteria, userId, session)

    await Promise.all([
      this.taskService.deleteTasksByCriteria(
        { columnIds: columnsToDelete.map((c) => c.id.toString()) },
        userId,
        session,
      ),
    ])

    return {
      data: deleteResult,
      logId: log.id,
    }
  }

  public async delete(
    criteria: IColumnCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<DeleteResult | null>> {
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
    criteria: IColumnCriteria,
    isRecover: boolean,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
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

    const columnsToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
    )

    if (isRecover) {
      const boardIds = columnsToProcess.map((c) => c.board.toString())
      await this._checkColumnsLimitByBoards(boardIds, user, session)
    }

    const columnsCriteria = { columnIds: columnsToProcess.map((b) => b.id.toString()) }

    if (columnsToProcess.length === 0) throw new NotFoundError('Колонки не найдены.')

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const entitiesBefore = projectProperties<IColumn>(columnsToProcess, data)
    const entitiesAfter = entitiesBefore.map((c) => ({ ...c, ...data }))

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.COLUMNS,
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
        columnsCriteria,
        { ...data, isDeletedExternal: isRecover ? false : true },
        user.id,
        session,
      ),

      /* PROCESS COLUMNS */
      this.repository.updateManyByCriteria(criteria, data, session, user.id),
    ])

    const sideEffects: Promise<any>[] = []

    await Promise.all(sideEffects)

    const updatedColumnsPopulated = await this.getByCriteria(
      { ids: entitiesAfter.map((c) => c.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedColumnsPopulated,
      logId: log.id,
    }
  }

  public async archive(
    criteria: IColumnCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, user, session, isDryRun),
      )
    }
  }

  public async recover(
    criteria: IColumnCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, user, session, isDryRun),
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: IColumnCriteria,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const dependencies: Types.ObjectId[] = []

    const columnsToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: isDryRun ? '-createdAt -updatedAt' : '+embeddings -createdAt -updatedAt',
      },
      user.id,
    )

    /** LIMITS CHECK */
    const boardIds = columnsToClone.map((c) => c.board.toString())
    await this._checkColumnsLimitByBoards(boardIds, user, session)

    if (columnsToClone.length === 0) throw new NotFoundError('Колонки для клонирования не найдены.')

    const columnsGrouppedByBoard: Map<string, (IColumn & { embeddings: number[] })[]> = new Map()
    columnsToClone.forEach((column) => {
      const boardId = column.board.toString()

      if (!columnsGrouppedByBoard.has(boardId)) {
        columnsGrouppedByBoard.set(boardId, [])
      }

      columnsGrouppedByBoard.get(boardId)!.push(column)
    })

    const uniqueBoardIds = [...new Set(columnsToClone.map((c) => c.board))]
    const lastRanksArray = await this.repository.getLastRanksByParents(
      uniqueBoardIds,
      'board',
      user.id,
      session,
    )
    const lastRankMap = new Map<string, string>()
    lastRanksArray.forEach((r) => {
      lastRankMap.set(r.parentId.toString(), r.rank)
    })

    const transformedColumns: IColumnCreatePayload[] = []

    for (const [boardId, columns] of columnsGrouppedByBoard) {
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i]
        const id = tempIds[i] || undefined

        const lastRankInMap = lastRankMap.get(boardId)
        let nextRank: string

        if (lastRankInMap) {
          nextRank = LexoRank.parse(lastRankInMap).genNext().toString()
        } else {
          nextRank = LexoRank.middle().toString()
        }

        lastRankMap.set(boardId, nextRank)

        const cleanColumn = {
          ...column,
          id: isDryRun ? column.id.toString() : id,
          name: `${column.name} (Копия)`,
          rank: nextRank,
        }

        transformedColumns.push(cleanColumn)
      }
    }

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CLONE,
          collectionName: CollectionsEnum.COLUMNS,
          entitiesAfter: transformedColumns,
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

    const clonedColumns = await this.repository.createMany(transformedColumns, session)

    const columnIdsMap: Map<
      string,
      {
        columnId: Types.ObjectId
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    > = new Map()

    columnsToClone.forEach((column, index) => {
      columnIdsMap.set(column.id.toString(), {
        columnId: clonedColumns[index].id,
        boardId: clonedColumns[index].board,
        workspaceId: clonedColumns[index].workspace,
      })
    })

    const cloneTasksResult = await this.taskService.cloneTasksByColumns(
      columnIdsMap,
      user.id,
      session,
    )

    if (cloneTasksResult.logId) dependencies.push(cloneTasksResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CLONE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesAfter: clonedColumns,
        dependencies,
      },
      user.id,
      session,
    )

    const clonedColumnsPopulated = await this.getByCriteria(
      { ids: clonedColumns.map((c) => c.id.toString()) },
      user.id,
      session,
    )

    return {
      data: clonedColumnsPopulated,
      logId: log.id,
    }
  }

  public async clone(
    criteria: IColumnCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeCloneTransaction(criteria, user, externalSession, isDryRun, tempIds)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, user, session, isDryRun, tempIds),
      )
    }
  }

  public async move(
    dto: ColumnMoveDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeMoveTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveTransaction(
    dto: ColumnMoveDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const { beforeId, afterId, id, newBoardId } = dto

    const columnIds = [id, beforeId, afterId].filter(Boolean) as string[]
    const columns = await this.repository.findByCriteria(
      { ids: columnIds },
      session,
      undefined,
      user.id,
    )

    const column = columns.find((t) => t.id.toString() === id)
    const beforeColumn = beforeId ? columns.find((t) => t.id.toString() === beforeId) : null
    const afterColumn = afterId ? columns.find((t) => t.id.toString() === afterId) : null

    if (!column) throw new NotFoundError('Колонка не найдена.')

    let newRank: LexoRank

    if (beforeColumn && afterColumn) {
      newRank = LexoRank.parse(beforeColumn.rank).between(LexoRank.parse(afterColumn.rank))
    } else if (beforeColumn) {
      newRank = LexoRank.parse(beforeColumn.rank).genPrev()
    } else if (afterColumn) {
      newRank = LexoRank.parse(afterColumn.rank).genNext()
    } else {
      if (newBoardId) {
        const lastRankData = await this.repository.getLastRanksByParents(
          [new Types.ObjectId(newBoardId)],
          'board',
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

    const updateData: SafeUpdateData<IColumn> = {
      rank: newRank.toString(),
    }

    if (newBoardId) {
      const [board] = await this.boardService.getByCriteria({ id: newBoardId }, user.id, session)
      if (!board) throw new NotFoundError('Доска не найдена.')

      updateData.board = board.id
      updateData.workspace = board.workspace.id
    }

    const columnsBefore = projectProperties<IColumn>([column], updateData)
    const columnsAfter = columnsBefore.map((t) => ({
      ...t,
      ...updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.COLUMNS,
          entitiesBefore: columnsBefore,
          entitiesAfter: columnsAfter,
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
        collectionName: CollectionsEnum.COLUMNS,
        entitiesBefore: columnsBefore,
        entitiesAfter: columnsAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedColumns = await this.getByCriteria({ id }, user.id, session)

    return {
      data: updatedColumns,
      logId: log.id,
    }
  }

  public async moveMany(
    dto: ColumnMoveManyDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeMoveManyTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveManyTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveManyTransaction(
    dto: ColumnMoveManyDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const { ids, beforeColumnId, afterColumnId, newBoardId, toStart, toEnd } = dto

    const uniqueColumnIds = [...new Set(ids)]
    if (uniqueColumnIds.length === 0) {
      throw new NotFoundError('Колонки не найдены.')
    }

    if (toStart && toEnd) {
      throw new AppError('Нельзя переместить колонки одновременно в начало и в конец.', 400)
    }

    if ((toStart || toEnd) && (beforeColumnId || afterColumnId)) {
      throw new AppError(
        'Нельзя одновременно использовать beforeColumnId/afterColumnId и toStart/toEnd.',
        400,
      )
    }

    if (beforeColumnId && uniqueColumnIds.includes(beforeColumnId)) {
      throw new AppError('beforeColumnId не может быть среди перемещаемых колонок.', 400)
    }

    if (afterColumnId && uniqueColumnIds.includes(afterColumnId)) {
      throw new AppError('afterColumnId не может быть среди перемещаемых колонок.', 400)
    }

    const relatedColumnIds = [
      ...new Set([...uniqueColumnIds, beforeColumnId, afterColumnId].filter(Boolean)),
    ]
    const columns = await this.repository.findByCriteria(
      { ids: relatedColumnIds as string[] },
      session,
      undefined,
      user.id,
    )

    const columnsToMove = columns
      .filter((column) => uniqueColumnIds.includes(column.id.toString()))
      .sort((a, b) => a.rank.localeCompare(b.rank))

    if (columnsToMove.length !== uniqueColumnIds.length) {
      throw new NotFoundError('Колонки не найдены.')
    }

    const beforeColumn = beforeColumnId
      ? columns.find((c) => c.id.toString() === beforeColumnId)
      : null
    const afterColumn = afterColumnId
      ? columns.find((c) => c.id.toString() === afterColumnId)
      : null

    if (beforeColumnId && !beforeColumn) {
      throw new NotFoundError('Опорная колонка beforeColumnId не найдена.')
    }

    if (afterColumnId && !afterColumn) {
      throw new NotFoundError('Опорная колонка afterColumnId не найдена.')
    }

    const moveWithinEachCurrentBoard =
      !newBoardId && !beforeColumn && !afterColumn && (toStart || toEnd)

    let targetBoard: Awaited<ReturnType<BoardService['getByCriteria']>>[number] | null = null
    let targetBoardId: string | null = null

    if (newBoardId) {
      const [board] = await this.boardService.getByCriteria({ id: newBoardId }, user.id, session)
      if (!board) throw new NotFoundError('Доска не найдена.')

      targetBoard = board
      targetBoardId = board.id.toString()
    } else if (beforeColumn || afterColumn) {
      const anchorColumn = beforeColumn ?? afterColumn

      if (!anchorColumn) {
        throw new AppError('Не удалось определить целевую доску для перемещения.', 400)
      }

      const [board] = await this.boardService.getByCriteria(
        { id: anchorColumn.board.toString() },
        user.id,
        session,
      )

      if (!board) throw new NotFoundError('Доска не найдена.')

      targetBoard = board
      targetBoardId = board.id.toString()
    } else if (!moveWithinEachCurrentBoard) {
      targetBoardId = columnsToMove[0].board.toString()

      const hasDifferentBoard = columnsToMove.some(
        (column) => column.board.toString() !== targetBoardId,
      )

      if (hasDifferentBoard) {
        throw new AppError(
          'Для массового перемещения без newBoardId все колонки должны быть из одной доски.',
          400,
        )
      }
    } else {
      targetBoardId = null
    }

    if (beforeColumn && beforeColumn.board.toString() !== targetBoardId) {
      throw new AppError('beforeColumnId должен принадлежать целевой доске.', 400)
    }

    if (afterColumn && afterColumn.board.toString() !== targetBoardId) {
      throw new AppError('afterColumnId должен принадлежать целевой доске.', 400)
    }

    let newRanks: string[] = []

    if (moveWithinEachCurrentBoard) {
      const updatesWithMetadata: Array<{
        column: IColumn
        updateData: SingleUpdateDTO<SafeUpdateData<IColumn>>
      }> = []

      const columnsByBoard = new Map<string, IColumn[]>()
      for (const column of columnsToMove) {
        const boardId = column.board.toString()
        const currentGroup = columnsByBoard.get(boardId) || []
        currentGroup.push(column)
        columnsByBoard.set(boardId, currentGroup)
      }

      for (const [boardId, boardColumns] of columnsByBoard.entries()) {
        if (toStart) {
          const firstColumnsInBoard = await this.repository.findByCriteria(
            { boardId },
            session,
            { sort: { rank: 1 }, limit: 1 },
            user.id,
          )

          let rankCursor =
            firstColumnsInBoard.length > 0
              ? LexoRank.parse(firstColumnsInBoard[0].rank)
              : LexoRank.middle()

          const boardRanks: string[] = []
          for (let i = 0; i < boardColumns.length; i++) {
            rankCursor =
              firstColumnsInBoard.length > 0 ? rankCursor.genPrev() : rankCursor.genNext()
            boardRanks.push(rankCursor.toString())
          }

          if (firstColumnsInBoard.length > 0) {
            boardRanks.reverse()
          }

          boardColumns.forEach((column, index) => {
            updatesWithMetadata.push({
              column,
              updateData: {
                id: column.id,
                rank: boardRanks[index],
              },
            })
          })
        } else {
          const lastRankData = await this.repository.getLastRanksByParents(
            [new Types.ObjectId(boardId)],
            'board',
            user.id,
            session,
          )

          let rankCursor = lastRankData.length
            ? LexoRank.parse(lastRankData[0].rank)
            : LexoRank.middle()

          boardColumns.forEach((column) => {
            rankCursor = rankCursor.genNext()
            updatesWithMetadata.push({
              column,
              updateData: {
                id: column.id,
                rank: rankCursor.toString(),
              },
            })
          })
        }
      }

      const entitiesBefore = updatesWithMetadata.map(
        ({ column, updateData }) => projectProperties<IColumn>([column], updateData)[0],
      )
      const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
        ...beforeEntity,
        ...updatesWithMetadata[index].updateData,
      }))

      if (isDryRun) {
        const log = await this.operationLogService.create(
          {
            operationType: OperationTypesEnum.UPDATE,
            collectionName: CollectionsEnum.COLUMNS,
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
        throw new AppError('Не удалось переместить колонки.', 500)
      }

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.COLUMNS,
          entitiesBefore,
          entitiesAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.SUCCESS,
        },
        user.id,
        session,
      )

      const updatedColumns = await this.getByCriteria(
        { ids: columnsToMove.map((column) => column.id.toString()) },
        user.id,
        session,
      )

      return {
        data: updatedColumns,
        logId: log.id,
      }
    }

    if (targetBoardId === null) {
      throw new AppError('Не удалось определить целевую доску для перемещения.', 400)
    }

    if (toStart) {
      const firstColumnsInBoard = await this.repository.findByCriteria(
        { boardId: targetBoardId },
        session,
        { sort: { rank: 1 }, limit: 1 },
        user.id,
      )

      if (firstColumnsInBoard.length > 0) {
        const generatedRanks: string[] = []
        let rankCursor = LexoRank.parse(firstColumnsInBoard[0].rank)

        for (let i = 0; i < columnsToMove.length; i++) {
          rankCursor = rankCursor.genPrev()
          generatedRanks.push(rankCursor.toString())
        }

        newRanks = generatedRanks.reverse()
      } else {
        let rankCursor = LexoRank.middle()
        for (let i = 0; i < columnsToMove.length; i++) {
          rankCursor = rankCursor.genNext()
          newRanks.push(rankCursor.toString())
        }
      }
    } else if (beforeColumn && afterColumn) {
      let left = LexoRank.parse(beforeColumn.rank)
      const right = LexoRank.parse(afterColumn.rank)

      for (let i = 0; i < columnsToMove.length; i++) {
        left = left.between(right)
        newRanks.push(left.toString())
      }
    } else if (beforeColumn) {
      const generatedRanks: string[] = []
      let rankCursor = LexoRank.parse(beforeColumn.rank)

      for (let i = 0; i < columnsToMove.length; i++) {
        rankCursor = rankCursor.genPrev()
        generatedRanks.push(rankCursor.toString())
      }

      newRanks = generatedRanks.reverse()
    } else if (afterColumn) {
      let rankCursor = LexoRank.parse(afterColumn.rank)

      for (let i = 0; i < columnsToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    } else {
      const lastRankData = await this.repository.getLastRanksByParents(
        [new Types.ObjectId(targetBoardId)],
        'board',
        user.id,
        session,
      )

      let rankCursor = lastRankData.length
        ? LexoRank.parse(lastRankData[0].rank)
        : LexoRank.middle()

      for (let i = 0; i < columnsToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    }

    const updatesWithMetadata = columnsToMove.map((column, index) => {
      const updateData: SingleUpdateDTO<SafeUpdateData<IColumn>> = {
        id: column.id,
        rank: newRanks[index],
      }

      if (targetBoard) {
        updateData.board = targetBoard.id
        updateData.workspace = targetBoard.workspace.id
      }

      return {
        column,
        updateData,
      }
    })

    if (targetBoard) {
      const columnsWithNewBoard = updatesWithMetadata
        .filter(({ column }) => column.board.toString() !== targetBoard.id.toString())
        .map(() => ({ boardId: targetBoard.id.toString() }))
      const boardIds = columnsWithNewBoard.map((c) => c.boardId)

      await this._checkColumnsLimitByBoards(boardIds, user, session)
    }

    const entitiesBefore = updatesWithMetadata.map(
      ({ column, updateData }) => projectProperties<IColumn>([column], updateData)[0],
    )
    const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
      ...beforeEntity,
      ...updatesWithMetadata[index].updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.COLUMNS,
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
      throw new AppError('Не удалось переместить колонки.', 500)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesBefore,
        entitiesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedColumns = await this.getByCriteria(
      { ids: columnsToMove.map((column) => column.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedColumns,
      logId: log.id,
    }
  }

  private async _executeReorderTransaction(
    dto: ColumnReorderDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    const { ids, boardId } = dto

    const columns = await this.repository.findByCriteria({ ids }, session, undefined, user.id)

    const isAllFromSameBoard = columns.every((column) => column.board.toString() === boardId)

    if (!isAllFromSameBoard) {
      throw new AppError('Все колонки должны принадлежать одной доске.', 400)
    }

    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<IColumn>>[] = []
    let currentRank = LexoRank.middle()

    const columnsMap = new Map(columns.map((c) => [c.id.toString(), c]))

    ids.forEach((columnId, index) => {
      bulkUpdates.push({
        id: new Types.ObjectId(columnId),
        rank: currentRank.toString(),
      })

      if (index < ids.length - 1) {
        currentRank = currentRank.genNext()
      }
    })

    const updatesWithMetadata = bulkUpdates.map((updateData) => {
      const column = columnsMap.get(updateData.id.toString())!
      return { column, updateData }
    })

    const entitiesBefore = updatesWithMetadata.map(
      ({ column, updateData }) => projectProperties<IColumn>([column], updateData)[0],
    )
    const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
      ...beforeEntity,
      ...updatesWithMetadata[index].updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.COLUMNS,
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
      throw new AppError('Не удалось переупорядочить колонки.', 500)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesBefore,
        entitiesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedColumns = await this.getByCriteria({ ids }, user.id, session)

    return {
      data: updatedColumns,
      logId: log.id,
    }
  }

  public async reorder(
    dto: ColumnReorderDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IColumnPopulated[]>> {
    if (externalSession) {
      return this._executeReorderTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeReorderTransaction(dto, user, session, isDryRun),
      )
    }
  }

  public async revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<any>> {
    const { operationType } = log

    const before = log.entitiesBefore as (Partial<IColumn> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<IColumn> & { id: Types.ObjectId })[]

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

  public async updateLifecycleColumnsByCriteria(
    criteria: IColumnCriteria,
    data: SafeUpdateData<IColumn>,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    await this.repository.findByCriteria(criteria, session, undefined, userId)

    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
  }

  public async deleteColumnsByCriteria(
    criteria: IColumnCriteria,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<DeleteResult> {
    return await this.repository.deleteMany(criteria, userId, session)
  }

  public async cloneColumnsByBoards(
    boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IColumn[]>> {
    const sourceColumns = await this.repository.findByCriteria(
      { boardIds: Array.from(boardIdsMap.keys()), isDeleted: false, isDeletedExternal: false },
      session,
      undefined,
      userId,
    )
    const dependencies: Types.ObjectId[] = []

    const cleanColumns = sourceColumns.map((column) => {
      const boardData = boardIdsMap.get(column.board.toString())

      if (!boardData) {
        throw new AppError('Ошибка при клонировании колонок: не найдена целевая доска.', 400)
      }

      return {
        ...column,
        board: boardData.boardId,
        workspace: boardData.workspaceId,
        id: undefined,
      }
    })

    const clonedColumns = await this.repository.createMany(cleanColumns, session)

    const columnIdsMap: Map<
      string,
      {
        columnId: Types.ObjectId
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    > = new Map()

    sourceColumns.forEach((column, index) => {
      columnIdsMap.set(column.id.toString(), {
        columnId: clonedColumns[index].id,
        boardId: clonedColumns[index].board,
        workspaceId: clonedColumns[index].workspace,
      })
    })

    const tasksCloneResult = await this.taskService.cloneTasksByColumns(
      columnIdsMap,
      userId,
      session,
    )

    if (tasksCloneResult.logId) dependencies.push(tasksCloneResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.COLUMNS,
        entitiesAfter: clonedColumns,
        dependencies,
      },
      userId,
      session,
    )

    return {
      data: clonedColumns,
      logId: log.id,
    }
  }

  private async prepareColumnCreationPayload(
    data: ColumnDTO,
    columnBoard: IBoardPopulated,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IColumnCreatePayload> {
    const columnName = data.name.trim()

    let columnRank = LexoRank.middle().toString()

    /* RANKING */
    const lastColumnsInBoard = await this.repository.findByCriteria(
      { boardId: data.boardId },
      session,
      { sort: { rank: -1 }, limit: 1 },
      userId,
    )
    if (lastColumnsInBoard.length > 0) {
      const lastColumn = lastColumnsInBoard[0]
      const lastRank = LexoRank.parse(lastColumn.rank)

      columnRank = lastRank.genNext().toString()
    }

    const columnPayload: IColumnCreatePayload = {
      name: columnName,
      workspace: columnBoard.workspace.id,
      board: columnBoard.id,
      rank: columnRank,
      embeddings: [],
      userId,
    }

    return columnPayload
  }

  private async prepareColumnsCreationPayload(
    data: ColumnDTO[],
    columnsBoardMap: Map<string, IBoardPopulated>,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IColumnCreatePayload[]> {
    const columnsPayloads: IColumnCreatePayload[] = []
    const columnsGroupedByBoard: { [key: string]: ColumnDTO[] } = {}
    const uniqueBoardIds = Array.from(
      new Set(data.map((column) => new Types.ObjectId(column.boardId))),
    )

    data.forEach((column) => {
      const boardId = column.boardId
      if (!columnsGroupedByBoard[boardId]) {
        columnsGroupedByBoard[boardId] = []
      }

      columnsGroupedByBoard[boardId].push(column)
    })

    const lastRanksByBoards = await this.repository.getLastRanksByParents(
      uniqueBoardIds,
      'board',
      userId,
      session,
    )

    for (const [boardId, columns] of Object.entries(columnsGroupedByBoard)) {
      let lastRank = LexoRank.middle()

      const lastRankData = lastRanksByBoards.find((r) => r.parentId.toString() === boardId)
      if (lastRankData) {
        lastRank = LexoRank.parse(lastRankData.rank)
      }

      for (const column of columns) {
        const newRank = lastRank.genNext()
        const columnName = column.name.trim()

        columnsPayloads.push({
          id: column.id,
          name: columnName,
          workspace: columnsBoardMap.get(column.boardId)!.workspace.id,
          board: columnsBoardMap.get(column.boardId)!.id,
          rank: newRank.toString(),
          embeddings: [],
          userId,
        })

        lastRank = newRank
      }
    }

    return columnsPayloads
  }

  private scheduleEmbeddingsGeneration(columns: IColumnPopulated[], userId: Types.ObjectId) {
    const columnsByName = new Map<string, Types.ObjectId[]>()

    for (const column of columns) {
      const columnName = column.name.trim()
      const ids = columnsByName.get(columnName) || []
      ids.push(column.id)
      columnsByName.set(columnName, ids)
    }

    void this.generateEmbeddings(columnsByName, userId).catch((error) => {
      console.error('Failed to generate column embeddings:', error)
    })
  }

  private async generateEmbeddings(
    columnsByName: Map<string, Types.ObjectId[]>,
    userId: Types.ObjectId,
  ) {
    const columnNames = Array.from(columnsByName.keys())
    if (columnNames.length === 0) return

    const embeddings = await this.embeddingService.getEmbeddingsForMultipleTexts(columnNames)
    const updates = embeddings.flatMap((embedding, index) => {
      const name = columnNames[index]!

      return (columnsByName.get(name) || []).map((id) => ({
        id,
        name,
        embeddings: embedding,
      }))
    })

    await this.repository.updateEmbeddings(updates, userId)
  }

  private async _prepareMainEditFields(
    data: Omit<ColumnEditDTO, 'id'>,
    columnPayload: SafeUpdateData<IColumn>,
    columnsToUpdate: IColumn[],
    isDryRun: boolean = false,
  ) {
    if (!isDryRun && data.name && columnsToUpdate.length > 0) {
      const needEmbeddingsUpdate = columnsToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const columnName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(columnName)

        columnPayload.embeddings = embeddings
      }
    }
  }

  private async prepareColumnEditPayload(
    data: Omit<ColumnEditDTO, 'id'>,
    columnsToUpdate: IColumn[],
    columnsBoardMap: Map<string, IBoardPopulated>,
  ): Promise<SafeUpdateData<IColumn>> {
    const columnPayload: SafeUpdateData<IColumn> = {
      ...data,
    }

    if (data.boardId) {
      const boardData = columnsBoardMap.get(data.boardId)

      if (boardData) {
        columnPayload.board = boardData.id
        columnPayload.workspace = boardData.workspace.id
      }
    }

    await this._prepareMainEditFields(data, columnPayload, columnsToUpdate)

    return columnPayload
  }

  private async prepareColumnEditManyPayload(
    data: ColumnEditDTO,
    columnsToUpdate: IColumn[],
    columnsBoardMap: Map<string, IBoardPopulated>,
    isDryRun: boolean = false,
  ): Promise<SingleUpdateDTO<SafeUpdateData<IColumn>>> {
    const { id, ...rest } = data

    const column = columnsToUpdate[0]

    const columnPayload: SingleUpdateDTO<SafeUpdateData<IColumn>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    if (data.boardId !== undefined && column.board.toString() !== data.boardId) {
      const boardData = columnsBoardMap.get(data.boardId)

      if (!boardData) {
        throw new NotFoundError('Доска не найдена.')
      }

      columnPayload.board = boardData.id
      columnPayload.workspace = boardData.workspace.id
    }

    await this._prepareMainEditFields(rest, columnPayload, columnsToUpdate, isDryRun)

    return columnPayload
  }

  public async getColumnsCountByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(boardIds, 'board', userId, session)
  }

  public async getColumnsCountByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(workspaceIds, 'workspace', userId, session)
  }
}
