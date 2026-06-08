import { ITaskRaw } from '@entities/ITaskRaw.js'
import TaskRepository from '@repositories/TaskRepository.js'
import { TaskDTO } from '@application/dtos/TaskDTO.js'
import mongoose, { ClientSession, DeleteResult, Types, UpdateWriteOpResult } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.js'
import { ITaskCriteria } from '@criterias/ITaskCriteria.js'
import { OperationLogService } from '@application/services/OperationLogService.js'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.js'
import { IUser } from '@entities/IUser.js'
import { ITask } from '@entities/ITask.js'
import { TaskEditDTO } from '@dtos/TaskEditDTO.js'
import { NotFoundError } from '@errors/NotFound.js'
import { ColumnService } from '@application/services/ColumnService.js'

import dayjs from 'dayjs'
import { LexoRank } from 'lexorank'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.js'
import { projectProperties } from '@/utils/projectProperties.js'
import { IResponseWithLog } from '../interfaces/IResponseWithLog.js'
import { IOperationLog } from '@/domain/entities/IOperationLog.js'
import { AppError } from '@/domain/errors/AppError.js'
import { BoardService } from '@application/services/BoardService.js'
import { WorkspaceService } from '@application/services/WorkspaceService.js'
import { LifecycleDTO } from '@dtos/LifecycleDTO.js'
import { ITaskPopulated } from '@interfaces/ITaskPopulated.js'
import { BaseService } from '@application/services/BaseService.js'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.js'
import { ITaskCreatePayload } from '../interfaces/ITaskCreatePayload.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'
import { TaskMoveDTO } from '../dtos/TaskMoveDTO.js'
import { TaskMoveManyDTO } from '@dtos/TaskMoveManyDTO.js'
import { LimitService } from './LimitService.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { IColumnPopulated } from '../interfaces/IColumnPopulated.js'

const MAX_RETRIES = 3

export class TaskService extends BaseService<
  ITaskRaw,
  ITask,
  ITaskCriteria,
  ITaskPopulated,
  ITaskCreatePayload
> {
  protected repository: TaskRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected columnService: ColumnService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService
  protected limitService: LimitService

  constructor(
    taskRepository: TaskRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    columnService: ColumnService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
    limitService: LimitService,
  ) {
    super(taskRepository)

    this.repository = taskRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.columnService = columnService
    this.boardService = boardService
    this.workspaceService = workspaceService
    this.limitService = limitService
  }

  protected getPopulateOptions() {
    return [
      { path: 'column', select: 'name' },
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
    data: TaskDTO,
    user: IUser,
    session: ClientSession,
    timezone: string,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const taskColumns = await this.columnService.getByCriteria(
      { id: data.columnId },
      user.id,
      session,
    )

    if (taskColumns.length === 0) {
      throw new NotFoundError(ErrorMessages.COLUMN_NOT_FOUND)
    }

    const taskColumn = taskColumns[0]

    /** LIMITS CHECK */
    await this.limitService.checkTasksLimit(user, taskColumn.board.id.toString(), session)

    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const taskPayload = await this.prepareTaskCreationPayload(data, taskColumn, user.id, timezone)

    /* CREATE */
    const newTask = await this.repository.create(taskPayload, session)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: [newTask],
        dependencies: [],
      },
      user.id,
      session,
    )

    const newTaskPopulated = await this.getByCriteria(
      { id: newTask.id.toString() },
      user.id,
      session,
    )

    newTaskPopulated[0].tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

    return {
      data: newTaskPopulated,
      logId: log.id,
    }
  }

  public async create(
    data: TaskDTO,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]> | ITaskCreatePayload> {
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session, user.timezone),
      )
    }
  }

  private async _checkTasksLimitByBoards(boardIds: string[], user: IUser, session: ClientSession) {
    if (boardIds.length === 0) return

    const uniqueBoardIds = [...new Set(boardIds)]

    const incomingCounts: Record<string, number> = {}
    for (const boardId of boardIds) {
      incomingCounts[boardId] = (incomingCounts[boardId] || 0) + 1
    }

    await this.limitService.checkTasksLimitByBoards(user, uniqueBoardIds, incomingCounts, session)
  }

  private async _getTasksColumnMap(
    tasks: Pick<TaskEditDTO, 'columnId'>[],
    user: IUser,
    session: ClientSession,
  ): Promise<Map<string, IColumnPopulated>> {
    const filteredTasks = tasks.filter((t) => t.columnId !== undefined)
    const columnIds = [...new Set(filteredTasks.map((t) => t.columnId!))]

    const columns = await this.columnService.getByCriteria({ ids: columnIds }, user.id, session)

    const columnMap = new Map<string, IColumnPopulated>()

    columns.forEach((cat) => {
      columnMap.set(cat.id.toString(), cat)
    })

    const tasksColumnMap = new Map<string, IColumnPopulated>()

    filteredTasks.forEach((task) => {
      const column = columnMap.get(task.columnId!)

      if (column) {
        tasksColumnMap.set(task.columnId!, column)
      }
    })

    return tasksColumnMap
  }

  private async _executeCreateManyTransaction(
    data: TaskDTO[],
    user: IUser,
    session: ClientSession,
    timezone: string,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksColumnMap = await this._getTasksColumnMap(data, user, session)
    const boardIds = Array.from(tasksColumnMap.values()).map((cat) => cat.board.id.toString())

    /** LIMITS CHECK */
    await this._checkTasksLimitByBoards(boardIds, user, session)

    const tasksPayload = await this.prepareTasksCreationPayload(
      data,
      tasksColumnMap,
      user.id,
      timezone,
      session,
      isDryRun,
    )

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesAfter: tasksPayload,
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
    const newTasks = await this.repository.createMany(tasksPayload, session)

    const newTasksPopulated = await this.getByCriteria(
      { ids: newTasks.map((t) => t.id.toString()) },
      user.id,
      session,
    )

    newTasksPopulated.forEach((nt, index) => {
      nt.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity
    })

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: newTasks,
        dependencies: [],
      },
      user.id,
      session,
    )

    return {
      data: newTasksPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: TaskDTO[],
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeCreateManyTransaction(
        data,
        user,
        externalSession,
        user.timezone,
        isDryRun,
      )
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, user, session, user.timezone, isDryRun),
      )
    }
  }

  private async _executeEditTransaction(
    data: Omit<TaskEditDTO, 'id'>,
    criteria: ITaskCriteria,
    user: IUser,
    session: ClientSession,
    timezone: string,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksToUpdate: ITask[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
    )

    if (tasksToUpdate.length === 0) throw new NotFoundError('Задачи для редактирования не найдены.')

    const tasksColumnMap = await this._getTasksColumnMap([data], user, session)

    const taskPayload = await this.prepareTaskEditPayload(
      data,
      tasksToUpdate,
      tasksColumnMap,
      timezone,
    )
    const tasksBefore = projectProperties<ITask>(tasksToUpdate, taskPayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      taskPayload,
      session,
      user.id,
    )

    if (updateManyResult.modifiedCount === 0) throw new AppError('Не удалось обновить задачи.', 500)

    const sideEffects: Promise<any>[] = []

    /* MOVED */
    const tasksToMove = tasksToUpdate.filter(
      (t) => data.columnId !== undefined && t.column.toString() !== data.columnId,
    )

    if (tasksToMove.length > 0) {
      await this.moveTasksByColumns(
        tasksToMove.map((task) => task.id.toString()),
        user,
        session,
        true,
      )
    }

    const updatedTasks = await this.repository.findByCriteria<ITask>(
      criteria,
      session,
      undefined,
      user.id,
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: projectProperties<ITask>(updatedTasks, taskPayload),
        dependencies: [],
      },
      user.id,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedTasksPopulated = await this.getByCriteria(criteria, user.id, session)

    return {
      data: updatedTasksPopulated,
      logId: log.id,
    }
  }

  public async edit(
    data: Omit<TaskEditDTO, 'id'>,
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeEditTransaction(data, criteria, user, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, user, session, user.timezone),
      )
    }
  }

  private async _executeEditManyTransaction(
    data: TaskEditDTO[],
    user: IUser,
    session: ClientSession,
    timezone: string,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const taskIds = data.map((d) => d.id)

    const existingTasks = await this.repository.findByCriteria(
      { ids: taskIds },
      session,
      undefined,
      user.id,
    )

    if (existingTasks.length === 0) {
      throw new NotFoundError('Задачи для обновления не найдены.')
    }

    const existingMap = new Map(existingTasks.map((t) => [t.id.toString(), t]))

    const taskPayloads: SingleUpdateDTO<SafeUpdateData<ITask>>[] = []
    const tasksBefore: (Partial<ITask> & { id: Types.ObjectId })[] = []
    const movedTaskIds: string[] = []

    // Need to fill the taskPayload with correct column/board/workspace ids in case of moving
    const tasksWithNewColumnIds = data.filter((d) => {
      const task = existingMap.get(d.id)
      return task && d.columnId !== undefined && task.column.toString() !== d.columnId
    })
    const tasksColumnMap = await this._getTasksColumnMap(tasksWithNewColumnIds, user, session)

    for (const dto of data) {
      const task = existingMap.get(dto.id)
      if (!task) continue

      const taskPayload = await this.prepareTaskEditManyPayload(
        dto,
        [task],
        tasksColumnMap,
        timezone,
        isDryRun,
      )
      const taskBefore = projectProperties<ITask>([task], taskPayload)[0]

      tasksBefore.push(taskBefore)
      taskPayloads.push(taskPayload)

      const isMoving = dto.columnId !== undefined && task.column.toString() !== dto.columnId
      if (isMoving) {
        movedTaskIds.push(dto.id)
      }
    }

    if (isDryRun) {
      const tasksAfter = tasksBefore.map((t) => {
        const payload = taskPayloads.find((p) => p.id.toString() === t.id.toString())

        if (!payload) return t

        return {
          ...t,
          ...payload,
        }
      })

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesBefore: tasksBefore,
          entitiesAfter: tasksAfter,
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

    const updatedTasksResult = await this.repository.bulkUpdate(taskPayloads, user.id, session)

    if (!updatedTasksResult || updatedTasksResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить задачи.', 500)
    }

    const sideEffects: Promise<any>[] = []

    /** MOVE */
    if (movedTaskIds.length > 0) {
      await this.moveTasksByColumns(movedTaskIds, user, session, true)
    }

    const updatedTasks = await this.repository.findByCriteria(
      { ids: taskPayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      user.id,
    )

    const projectedUpdatedTasks = updatedTasks.map(
      (t) =>
        projectProperties<ITask>(
          [t],
          taskPayloads.find((p) => p.id.toString() === t.id.toString())!,
        )[0],
    )

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: projectedUpdatedTasks,
        dependencies: [],
      },
      user.id,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    const updatedTasksPopulated = await this.getByCriteria(
      { ids: taskPayloads.map((p) => p.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedTasksPopulated,
      logId: log.id,
    }
  }

  public async editMany(
    data: TaskEditDTO[],
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeEditManyTransaction(data, user, externalSession, user.timezone, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, user, session, user.timezone, isDryRun),
      )
    }
  }

  public async moveTasksByColumns(
    taskIds: string[],
    user: IUser,
    session: ClientSession,
    isRerank = false,
  ) {
    const tasks = await this.repository.findByCriteria(
      { ids: taskIds },
      session,
      {
        sort: { rank: 1 },
      },
      user.id,
    )
    if (!tasks.length) return

    const columnIds = [...new Set(tasks.map((t) => t.column))]

    const [columns, lastRanksArray] = await Promise.all([
      this.columnService.getByCriteria(
        { ids: columnIds.map((id) => id.toString()) },
        user.id,
        session,
      ),
      this.repository.getLastRanksByParents(columnIds, 'column', user.id, session),
    ])

    const columnMap = new Map(columns.map((c) => [c.id.toString(), c]))

    const lastRankMap = new Map<string, string>()
    lastRanksArray.forEach((r) => {
      lastRankMap.set(r.parentId.toString(), r.rank)
    })

    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<ITask>>[] = []
    const tasksWithNewBoard: { boardId: string }[] = []

    for (const task of tasks) {
      const catIdStr = task.column.toString()
      const column = columnMap.get(catIdStr)

      if (!column) continue

      const update: SingleUpdateDTO<SafeUpdateData<ITask>> = {
        id: task.id,
        column: column.id,
        board: column.board.id,
        workspace: column.workspace.id,
      }

      if (task.board.toString() !== column.board.id.toString()) {
        tasksWithNewBoard.push({ boardId: column.board.id.toString() })
      }

      if (isRerank) {
        const currentLastRank = lastRankMap.get(catIdStr)
        let nextRank: string

        if (currentLastRank) {
          nextRank = LexoRank.parse(currentLastRank).genNext().toString()
        } else {
          nextRank = LexoRank.middle().toString()
        }

        update.rank = nextRank

        lastRankMap.set(catIdStr, nextRank)
      }

      bulkUpdates.push(update)
    }

    if (bulkUpdates.length > 0) {
      const boardIds = tasksWithNewBoard.map((t) => t.boardId)
      await this._checkTasksLimitByBoards(boardIds, user, session)

      return await this.repository.bulkUpdate(bulkUpdates, user.id, session)
    }

    return null
  }

  public async moveTasksByBoards(taskIds: string[], user: IUser, session: ClientSession) {
    const tasks = await this.repository.findByCriteria(
      { ids: taskIds },
      session,
      undefined,
      user.id,
    )
    if (!tasks.length) return

    const boardIds = [...new Set(tasks.map((t) => t.board.toString()))]

    const boards = await this.boardService.getByCriteria({
      ids: boardIds,
    })

    const boardMap = new Map(boards.map((b) => [b.id.toString(), b]))

    const bulkUpdates = tasks.reduce(
      (acc, task) => {
        const board = boardMap.get(task.board.toString())

        if (board) {
          acc.push({
            id: task.id,
            board: board.id,
            workspace: board.workspace.id,
          })
        }
        return acc
      },
      [] as SingleUpdateDTO<SafeUpdateData<ITask>>[],
    )

    if (bulkUpdates.length > 0) {
      return await this.repository.bulkUpdate(bulkUpdates, user.id, session)
    }

    return null
  }

  private async _executeDeleteTransaction(
    criteria: ITaskCriteria,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<DeleteResult | null>> {
    const tasksToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
    )

    if (tasksToDelete.length === 0) {
      throw new NotFoundError('Задачи для удаления не найдены.')
    }

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.DELETE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: [],
        status,
        dependencies: [],
      },
      user.id,
      session,
    )

    if (isDryRun) {
      return {
        data: null,
        logId: log.id,
      }
    }

    const result = await this.repository.deleteMany(criteria, user.id, session)

    return {
      data: result,
      logId: log.id,
    }
  }

  public async delete(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<DeleteResult | null>> {
    if (externalSession) {
      return this._executeDeleteTransaction(criteria, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, user, session, isDryRun),
      )
    }
  }

  private async _executeLifecycleTransaction(
    criteria: ITaskCriteria,
    isRecover: boolean,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
    )

    if (isRecover) {
      const boardIds = tasksToProcess.map((t) => t.board.toString())
      await this._checkTasksLimitByBoards(boardIds, user, session)
    }

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

    if (tasksToProcess.length === 0) throw new NotFoundError('Задачи не найдены.')

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const entitiesBefore = projectProperties<ITask>(tasksToProcess, data)
    const entitiesAfter = entitiesBefore.map((t) => ({ ...t, ...data }))

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.TASKS,
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

    const updateResult = await this.repository.updateManyByCriteria(
      criteria,
      data,
      session,
      user.id,
    )

    if (!updateResult || updateResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить задачи.', 500)

    const sideEffects: Promise<any>[] = []

    await Promise.all(sideEffects)

    const updatedTasksPopulated = await this.getByCriteria(
      { ids: tasksToProcess.map((t) => t.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedTasksPopulated,
      logId: log.id,
    }
  }

  public async archive(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, user, session, isDryRun),
      )
    }
  }

  public async recover(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, user, session, isDryRun),
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: ITaskCriteria,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksToClone: (ITask & { embeddings: number[] })[] = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: isDryRun ? '-createdAt -updatedAt' : '+embeddings -createdAt -updatedAt',
      },
      user.id,
    )

    /** LIMITS CHECK */
    const boardIds = tasksToClone.map((t) => t.board.toString())
    await this._checkTasksLimitByBoards(boardIds, user, session)

    if (tasksToClone.length === 0) throw new NotFoundError('Задачи для клонирования не найдены.')

    const tasksGrouppedByColumn: Map<string, (ITask & { embeddings: number[] })[]> = new Map()
    tasksToClone.forEach((task) => {
      const columnId = task.column.toString()

      if (!tasksGrouppedByColumn.has(columnId)) {
        tasksGrouppedByColumn.set(columnId, [])
      }

      tasksGrouppedByColumn.get(columnId)!.push(task)
    })

    const uniqueColumnIds = [...new Set(tasksToClone.map((t) => t.column))]
    const lastRanksArray = await this.repository.getLastRanksByParents(
      uniqueColumnIds,
      'column',
      user.id,
      session,
    )
    const lastRankMap = new Map<string, string>()
    lastRanksArray.forEach((r) => {
      lastRankMap.set(r.parentId.toString(), r.rank)
    })

    const transformedTasks: ITaskCreatePayload[] = []

    for (const [columnId, tasks] of tasksGrouppedByColumn) {
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        const id = tempIds[i] || undefined

        const lastRankInMap = lastRankMap.get(columnId)
        let nextRank: string

        if (lastRankInMap) {
          nextRank = LexoRank.parse(lastRankInMap).genNext().toString()
        } else {
          nextRank = LexoRank.middle().toString()
        }

        lastRankMap.set(columnId, nextRank)

        const cleanTask = {
          ...task,
          id: isDryRun ? task.id.toString() : id,
          name: `${task.name} (Копия)`,
          rank: nextRank,
        }

        transformedTasks.push(cleanTask)
      }
    }

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CLONE,
          collectionName: CollectionsEnum.TASKS,
          entitiesAfter: transformedTasks,
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

    const newTasks = await this.repository.createMany(transformedTasks, session)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CLONE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: newTasks,
        dependencies: [],
      },
      user.id,
      session,
    )

    const clonedTasksPopulated = await this.getByCriteria(
      { ids: newTasks.map((t) => t.id.toString()) },
      user.id,
      session,
    )

    return {
      data: [...clonedTasksPopulated],
      logId: log.id,
    }
  }

  public async clone(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeCloneTransaction(criteria, user, externalSession, isDryRun, tempIds)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, user, session, isDryRun, tempIds),
      )
    }
  }

  public async move(
    dto: TaskMoveDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeMoveTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveTransaction(dto, user, session, isDryRun),
      )
    }
  }

  public async moveMany(
    dto: TaskMoveManyDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (externalSession) {
      return this._executeMoveManyTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveManyTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveManyTransaction(
    dto: TaskMoveManyDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const { ids, beforeTaskId, afterTaskId, newColumnId, toStart, toEnd } = dto

    const uniqueTaskIds = [...new Set(ids)]
    if (uniqueTaskIds.length === 0) {
      throw new NotFoundError('Задачи не найдены.')
    }

    if (toStart && toEnd) {
      throw new AppError('Нельзя переместить задачи одновременно в начало и в конец.', 400)
    }

    if ((toStart || toEnd) && (beforeTaskId || afterTaskId)) {
      throw new AppError(
        'Нельзя одновременно использовать beforeTaskId/afterTaskId и toStart/toEnd.',
        400,
      )
    }

    if (beforeTaskId && uniqueTaskIds.includes(beforeTaskId)) {
      throw new AppError('beforeTaskId не может быть среди перемещаемых задач.', 400)
    }

    if (afterTaskId && uniqueTaskIds.includes(afterTaskId)) {
      throw new AppError('afterTaskId не может быть среди перемещаемых задач.', 400)
    }

    const relatedTaskIds = [
      ...new Set([...uniqueTaskIds, beforeTaskId, afterTaskId].filter(Boolean)),
    ]
    const tasks = await this.repository.findByCriteria(
      { ids: relatedTaskIds as string[] },
      session,
      undefined,
      user.id,
    )

    const tasksToMove = tasks
      .filter((task) => uniqueTaskIds.includes(task.id.toString()))
      .sort((a, b) => a.rank.localeCompare(b.rank))

    if (tasksToMove.length !== uniqueTaskIds.length) {
      throw new NotFoundError('Задачи не найдены.')
    }

    const beforeTask = beforeTaskId ? tasks.find((t) => t.id.toString() === beforeTaskId) : null
    const afterTask = afterTaskId ? tasks.find((t) => t.id.toString() === afterTaskId) : null

    if (beforeTaskId && !beforeTask) {
      throw new NotFoundError('Опорная задача beforeTaskId не найдена.')
    }

    if (afterTaskId && !afterTask) {
      throw new NotFoundError('Опорная задача afterTaskId не найдена.')
    }

    const moveWithinEachCurrentColumn =
      !newColumnId && !beforeTask && !afterTask && (toStart || toEnd)

    let targetColumn: Awaited<ReturnType<ColumnService['getByCriteria']>>[number] | null = null
    let targetColumnId: string | null = null

    if (newColumnId) {
      const [column] = await this.columnService.getByCriteria({ id: newColumnId }, user.id, session)
      if (!column) throw new NotFoundError('Категория не найдена.')

      targetColumn = column
      targetColumnId = column.id.toString()
    } else if (beforeTask || afterTask) {
      const anchorTask = beforeTask ?? afterTask

      if (!anchorTask) {
        throw new AppError('Не удалось определить целевую категорию для перемещения.', 400)
      }

      const [column] = await this.columnService.getByCriteria(
        { id: anchorTask.column.toString() },
        user.id,
        session,
      )

      if (!column) throw new NotFoundError('Категория не найдена.')

      targetColumn = column
      targetColumnId = column.id.toString()
    } else if (!moveWithinEachCurrentColumn) {
      targetColumnId = tasksToMove[0].column.toString()

      const hasDifferentColumn = tasksToMove.some(
        (task) => task.column.toString() !== targetColumnId,
      )

      if (hasDifferentColumn) {
        throw new AppError(
          'Для массового перемещения без newColumnId все задачи должны быть из одной категории.',
          400,
        )
      }
    } else {
      targetColumnId = null
    }

    if (beforeTask && beforeTask.column.toString() !== targetColumnId) {
      throw new AppError('beforeTaskId должен принадлежать целевой категории.', 400)
    }

    if (afterTask && afterTask.column.toString() !== targetColumnId) {
      throw new AppError('afterTaskId должен принадлежать целевой категории.', 400)
    }

    let newRanks: string[] = []

    if (moveWithinEachCurrentColumn) {
      const updatesWithMetadata: Array<{
        task: ITask
        updateData: SingleUpdateDTO<SafeUpdateData<ITask>>
      }> = []

      const tasksByColumn = new Map<string, ITask[]>()
      for (const task of tasksToMove) {
        const columnId = task.column.toString()
        const currentGroup = tasksByColumn.get(columnId) || []
        currentGroup.push(task)
        tasksByColumn.set(columnId, currentGroup)
      }

      for (const [columnId, columnTasks] of tasksByColumn.entries()) {
        if (toStart) {
          const firstTasksInColumn = await this.repository.findByCriteria(
            { columnId },
            session,
            { sort: { rank: 1 }, limit: 1 },
            user.id,
          )

          let rankCursor =
            firstTasksInColumn.length > 0
              ? LexoRank.parse(firstTasksInColumn[0].rank)
              : LexoRank.middle()

          const columnRanks: string[] = []
          for (let i = 0; i < columnTasks.length; i++) {
            rankCursor = firstTasksInColumn.length > 0 ? rankCursor.genPrev() : rankCursor.genNext()
            columnRanks.push(rankCursor.toString())
          }

          if (firstTasksInColumn.length > 0) {
            columnRanks.reverse()
          }

          columnTasks.forEach((task, index) => {
            updatesWithMetadata.push({
              task,
              updateData: {
                id: task.id,
                rank: columnRanks[index],
              },
            })
          })
        } else {
          const lastRankData = await this.repository.getLastRanksByParents(
            [new Types.ObjectId(columnId)],
            'column',
            user.id,
            session,
          )

          let rankCursor = lastRankData.length
            ? LexoRank.parse(lastRankData[0].rank)
            : LexoRank.middle()

          columnTasks.forEach((task) => {
            rankCursor = rankCursor.genNext()
            updatesWithMetadata.push({
              task,
              updateData: {
                id: task.id,
                rank: rankCursor.toString(),
              },
            })
          })
        }
      }

      const entitiesBefore = updatesWithMetadata.map(
        ({ task, updateData }) => projectProperties<ITask>([task], updateData)[0],
      )
      const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
        ...beforeEntity,
        ...updatesWithMetadata[index].updateData,
      }))

      if (isDryRun) {
        const log = await this.operationLogService.create(
          {
            operationType: OperationTypesEnum.UPDATE,
            collectionName: CollectionsEnum.TASKS,
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
        throw new AppError('Не удалось переместить задачи.', 500)
      }

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesBefore,
          entitiesAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.SUCCESS,
        },
        user.id,
        session,
      )

      const updatedTasks = await this.getByCriteria(
        { ids: tasksToMove.map((task) => task.id.toString()) },
        user.id,
        session,
      )

      return {
        data: updatedTasks,
        logId: log.id,
      }
    }

    if (targetColumnId === null) {
      throw new AppError('Не удалось определить целевую категорию для перемещения.', 400)
    }

    if (toStart) {
      const firstTasksInColumn = await this.repository.findByCriteria(
        { columnId: targetColumnId },
        session,
        { sort: { rank: 1 }, limit: 1 },
        user.id,
      )

      if (firstTasksInColumn.length > 0) {
        const generatedRanks: string[] = []
        let rankCursor = LexoRank.parse(firstTasksInColumn[0].rank)

        for (let i = 0; i < tasksToMove.length; i++) {
          rankCursor = rankCursor.genPrev()
          generatedRanks.push(rankCursor.toString())
        }

        newRanks = generatedRanks.reverse()
      } else {
        let rankCursor = LexoRank.middle()
        for (let i = 0; i < tasksToMove.length; i++) {
          rankCursor = rankCursor.genNext()
          newRanks.push(rankCursor.toString())
        }
      }
    } else if (beforeTask && afterTask) {
      let left = LexoRank.parse(beforeTask.rank)
      const right = LexoRank.parse(afterTask.rank)

      for (let i = 0; i < tasksToMove.length; i++) {
        left = left.between(right)
        newRanks.push(left.toString())
      }
    } else if (beforeTask) {
      const generatedRanks: string[] = []
      let rankCursor = LexoRank.parse(beforeTask.rank)

      for (let i = 0; i < tasksToMove.length; i++) {
        rankCursor = rankCursor.genPrev()
        generatedRanks.push(rankCursor.toString())
      }

      newRanks = generatedRanks.reverse()
    } else if (afterTask) {
      let rankCursor = LexoRank.parse(afterTask.rank)

      for (let i = 0; i < tasksToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    } else {
      const lastRankData = await this.repository.getLastRanksByParents(
        [new Types.ObjectId(targetColumnId)],
        'column',
        user.id,
        session,
      )

      let rankCursor = lastRankData.length
        ? LexoRank.parse(lastRankData[0].rank)
        : LexoRank.middle()

      for (let i = 0; i < tasksToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    }

    const updatesWithMetadata = tasksToMove.map((task, index) => {
      const updateData: SingleUpdateDTO<SafeUpdateData<ITask>> = {
        id: task.id,
        rank: newRanks[index],
      }

      if (targetColumn) {
        updateData.column = targetColumn.id
        updateData.board = targetColumn.board.id
        updateData.workspace = targetColumn.workspace.id
      }

      return {
        task,
        updateData,
      }
    })

    if (targetColumn) {
      const tasksWithNewBoard = updatesWithMetadata
        .filter(({ task }) => task.board.toString() !== targetColumn.board.id.toString())
        .map(() => ({ boardId: targetColumn.board.id.toString() }))
      const boardIds = tasksWithNewBoard.map((t) => t.boardId)

      await this._checkTasksLimitByBoards(boardIds, user, session)
    }

    const entitiesBefore = updatesWithMetadata.map(
      ({ task, updateData }) => projectProperties<ITask>([task], updateData)[0],
    )
    const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
      ...beforeEntity,
      ...updatesWithMetadata[index].updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.TASKS,
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
      throw new AppError('Не удалось переместить задачи.', 500)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore,
        entitiesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedTasks = await this.getByCriteria(
      { ids: tasksToMove.map((task) => task.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedTasks,
      logId: log.id,
    }
  }

  private async _executeMoveTransaction(
    dto: TaskMoveDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const { beforeId, afterId, id, newColumnId } = dto

    const taskIds = [id, beforeId, afterId].filter(Boolean) as string[]
    const tasks = await this.repository.findByCriteria(
      { ids: taskIds },
      session,
      undefined,
      user.id,
    )

    const task = tasks.find((t) => t.id.toString() === id)
    const beforeTask = beforeId ? tasks.find((t) => t.id.toString() === beforeId) : null
    const afterTask = afterId ? tasks.find((t) => t.id.toString() === afterId) : null

    if (!task) throw new NotFoundError('Задача не найдена.')

    let newRank: LexoRank

    if (beforeTask && afterTask) {
      newRank = LexoRank.parse(beforeTask.rank).between(LexoRank.parse(afterTask.rank))
    } else if (beforeTask) {
      newRank = LexoRank.parse(beforeTask.rank).genPrev()
    } else if (afterTask) {
      newRank = LexoRank.parse(afterTask.rank).genNext()
    } else {
      if (newColumnId) {
        const lastRankData = await this.repository.getLastRanksByParents(
          [new Types.ObjectId(newColumnId)],
          'column',
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

    const updateData: SafeUpdateData<ITask> = {
      rank: newRank.toString(),
    }

    if (newColumnId) {
      const [column] = await this.columnService.getByCriteria({ id: newColumnId }, user.id, session)
      if (!column) throw new NotFoundError('Категория не найдена.')

      updateData.column = column.id
      updateData.board = column.board.id
      updateData.workspace = column.workspace.id
    }

    const tasksBefore = projectProperties<ITask>([task], updateData)
    const tasksAfter = tasksBefore.map((t) => ({
      ...t,
      ...updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesBefore: tasksBefore,
          entitiesAfter: tasksAfter,
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
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: tasksAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedTasks = await this.getByCriteria({ id }, user.id, session)

    return {
      data: updatedTasks,
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

    const before = log.entitiesBefore as (Partial<ITask> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<ITask> & { id: Types.ObjectId })[]

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

  public async cloneTasksByColumns(
    columnIdsMap: Map<
      string,
      {
        columnId: Types.ObjectId
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ITask[]>> {
    const sourceTasks: (ITask & { embeddings: number[] })[] = await this.repository.findByCriteria(
      {
        columnIds: Array.from(columnIdsMap.keys()),
        isDeleted: false,
        isDeletedExternal: false,
      },
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId,
    )

    const cleanTasks = sourceTasks.map((task) => {
      const columnData = columnIdsMap.get(task.column.toString())

      if (!columnData) {
        throw new NotFoundError('Категория для клонирования не найдена.')
      }

      return {
        ...task,
        column: columnData.columnId,
        board: columnData.boardId,
        workspace: columnData.workspaceId,
        createdAt: undefined,
        updatedAt: undefined,
        id: undefined,
      }
    })

    const clonedTasks = await this.repository.createMany(cleanTasks, session)

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: clonedTasks,
        dependencies: [],
      },
      userId,
      session,
    )

    const clonedTasksTransformed = clonedTasks

    return {
      data: clonedTasksTransformed,
      logId: log.id,
    }
  }

  public async deleteTasksByCriteria(
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<DeleteResult> {
    return await this.repository.deleteMany(criteria, userId, session)
  }

  public async updateLifecycleTasksByCriteria(
    criteria: ITaskCriteria,
    data: SafeUpdateData<ITask>,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    await this.repository.findByCriteria(criteria, session, undefined, userId)

    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
  }

  public async prepareTaskCreationPayload(
    data: TaskDTO,
    taskColumn: IColumnPopulated,
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession,
    isEmbeddingsNeeded = true,
  ): Promise<ITaskCreatePayload> {
    const taskName = data.name.trim()

    const embeddings = isEmbeddingsNeeded ? await this.embeddingService.getEmbeddings(taskName) : []

    let taskRank = LexoRank.middle().toString()

    /* RANKING */
    const lastTasksInColumn = await this.repository.findByCriteria(
      { columnId: data.columnId },
      session,
      { sort: { rank: -1 }, limit: 1 },
      userId,
    )
    if (lastTasksInColumn.length > 0) {
      const lastTask = lastTasksInColumn[0]
      const lastRank = LexoRank.parse(lastTask.rank)

      taskRank = lastRank.genNext().toString()
    }

    const taskPayload: ITaskCreatePayload = {
      id: data.id,
      name: taskName,
      description: data.description,
      dueDate: data.dueDate,
      dueHours: data.dueHours,
      dueMinutes: data.dueMinutes,
      color: data.color
        ? {
            value: data.color.value,
            tone: data.color.tone,
          }
        : undefined,
      isCompleted: data.isCompleted,
      workspace: taskColumn.workspace.id,
      board: taskColumn.board.id,
      column: taskColumn.id,
      tags: data.tags ? data.tags.map((tag) => tag.toString()) : [],
      rank: taskRank,
      embeddings,
      userId,
    }

    this.prepareTaskMainFields(data, taskPayload, timezone)

    return taskPayload
  }

  public async prepareTasksCreationPayload(
    data: TaskDTO[],
    tasksColumnMap: Map<string, IColumnPopulated>,
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession,
    isDryRun = false,
  ): Promise<ITaskCreatePayload[]> {
    const tasksPayloads: ITaskCreatePayload[] = []
    const tasksGroupedByColumn: { [key: string]: TaskDTO[] } = {}
    const uniqueColumnIds = Array.from(
      new Set(data.map((task) => new Types.ObjectId(task.columnId))),
    )

    data.forEach((task) => {
      const columnId = task.columnId
      if (!tasksGroupedByColumn[columnId]) {
        tasksGroupedByColumn[columnId] = []
      }

      tasksGroupedByColumn[columnId].push(task)
    })

    const taskNames = Array.from(new Set(data.map((task) => task.name.trim())))
    const embeddingsMap: { [key: string]: number[] } = {}

    if (!isDryRun) {
      const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(taskNames)
      taskNames.forEach((name, index) => {
        embeddingsMap[name] = embeddingsArray[index]
      })
    }

    const lastRanksByColumns = await this.repository.getLastRanksByParents(
      uniqueColumnIds,
      'column',
      userId,
      session,
    )

    for (const [columnId, tasks] of Object.entries(tasksGroupedByColumn)) {
      let lastRank = LexoRank.middle()

      const lastRankData = lastRanksByColumns.find((r) => r.parentId.toString() === columnId)
      if (lastRankData) {
        lastRank = LexoRank.parse(lastRankData.rank)
      }

      for (const task of tasks) {
        const taskName = task.name.trim()
        const newRank = lastRank.genNext()

        const taskPayload: ITaskCreatePayload = {
          id: task.id,
          name: taskName,
          description: task.description,
          dueDate: task.dueDate,
          dueHours: task.dueHours,
          dueMinutes: task.dueMinutes,
          color: task.color
            ? {
                value: task.color.value,
                tone: task.color.tone,
              }
            : undefined,
          isCompleted: task.isCompleted,

          workspace: tasksColumnMap.get(task.columnId)!.workspace.id,
          board: tasksColumnMap.get(task.columnId)!.board.id,
          column: tasksColumnMap.get(task.columnId)!.id,

          tags: task.tags?.map((tag) => tag.toString()) ?? [],

          rank: newRank.toString(),
          embeddings: embeddingsMap[taskName],
          userId,
        }

        lastRank = newRank

        this.prepareTaskMainFields(task, taskPayload, timezone)

        tasksPayloads.push(taskPayload)
      }
    }

    return tasksPayloads
  }

  public prepareTaskMainFields(
    data: TaskDTO | Omit<TaskEditDTO, 'id'>,
    taskPayload: ITaskCreatePayload | SafeUpdateData<ITask>,
    timezone: string,
  ) {
    const isDueDateProvided = data.dueDate != null || taskPayload.dueDate != null
    const dueDate = data.dueDate || taskPayload.dueDate || dayjs().tz(timezone).format('YYYY-MM-DD')

    if (dueDate && data.dueHours != null && data.dueMinutes != null) {
      const collectedDateTime = `${dueDate}T${data.dueHours}:${data.dueMinutes}`
      const utcDueDate = dayjs.tz(collectedDateTime, timezone).utc()

      if (isDueDateProvided) taskPayload.dueDate = utcDueDate.format('YYYY-MM-DD')
      taskPayload.dueHours = utcDueDate.hour()
      taskPayload.dueMinutes = utcDueDate.minute()
    }
  }

  private async _prepareMainEditFields(
    data: Omit<TaskEditDTO, 'id'>,
    taskPayload: SafeUpdateData<ITask>,
    tasksToUpdate: ITask[],
    timezone: string,
    isDryRun: boolean = false,
  ) {
    if (data.tags) taskPayload.tags = data.tags.map((tag) => tag.toString())

    this.prepareTaskMainFields(data, taskPayload, timezone)

    if (!isDryRun && data.name && tasksToUpdate.length > 0) {
      const needEmbeddingsUpdate = tasksToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const taskName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(taskName)

        taskPayload.embeddings = embeddings
      }
    }
  }

  public async prepareTaskEditPayload(
    data: Omit<TaskEditDTO, 'id'>,
    tasksToUpdate: ITask[],
    tasksColumnMap: Map<string, IColumnPopulated>,
    timezone: string,
  ): Promise<SafeUpdateData<ITask>> {
    const taskPayload: SafeUpdateData<ITask> = {
      ...data,
    }

    if (data.columnId) {
      const columnData = tasksColumnMap.get(data.columnId)

      if (columnData) {
        taskPayload.column = columnData.id
        taskPayload.board = columnData.board.id
        taskPayload.workspace = columnData.workspace.id
      }
    }

    await this._prepareMainEditFields(data, taskPayload, tasksToUpdate, timezone)

    return taskPayload
  }

  public async prepareTaskEditManyPayload(
    data: TaskEditDTO,
    tasksToUpdate: ITask[],
    tasksColumnMap: Map<string, IColumnPopulated>,
    timezone: string,
    isDryRun: boolean = false,
  ): Promise<SingleUpdateDTO<SafeUpdateData<ITask>>> {
    const { id, ...rest } = data

    const task = tasksToUpdate[0]

    const taskPayload: SingleUpdateDTO<SafeUpdateData<ITask>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    if (data.columnId !== undefined && task.column.toString() !== data.columnId) {
      const columnData = tasksColumnMap.get(data.columnId)

      if (!columnData) {
        throw new NotFoundError('Категория не найдена.')
      }

      taskPayload.column = columnData.id
      taskPayload.board = columnData.board.id
      taskPayload.workspace = columnData.workspace.id
    }

    await this._prepareMainEditFields(rest, taskPayload, tasksToUpdate, timezone, isDryRun)

    return taskPayload
  }

  public async getTasksCountByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(boardIds, 'board', userId, session)
  }

  public async getTasksCountByColumns(
    columnIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(columnIds, 'column', userId, session)
  }

  public async getTasksCountByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(workspaceIds, 'workspace', userId, session)
  }
}
