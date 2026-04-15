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
import { CategoryService } from '@application/services/CategoryService.js'

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
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    taskRepository: TaskRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
  ) {
    super(taskRepository)

    this.repository = taskRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.categoryService = categoryService
    this.boardService = boardService
    this.workspaceService = workspaceService
  }

  protected getPopulateOptions() {
    return [
      { path: 'category', select: 'name' },
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
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const taskPayload = await this.prepareTaskCreationPayload(data, userId, timezone)

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
      userId,
      session,
    )

    const newTaskPopulated = await this.getByCriteria(
      { id: newTask.id.toString() },
      userId,
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
    const userId = user.id

    if (externalSession) {
      return this._executeCreateTransaction(data, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, userId, session, user.timezone),
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: TaskDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksPayload = await this.prepareTasksCreationPayload(
      data,
      userId,
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
        userId,
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
      userId,
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
      userId,
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
    const userId = user.id

    if (externalSession) {
      return this._executeCreateManyTransaction(
        data,
        userId,
        externalSession,
        user.timezone,
        isDryRun,
      )
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session, user.timezone, isDryRun),
      )
    }
  }

  private async _executeEditTransaction(
    data: Omit<TaskEditDTO, 'id'>,
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksToUpdate: ITask[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (tasksToUpdate.length === 0) throw new NotFoundError('Задачи для редактирования не найдены.')

    const taskPayload = await this.prepareTaskEditPayload(data, tasksToUpdate, timezone)
    const tasksBefore = projectProperties<ITask>(tasksToUpdate, taskPayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      taskPayload,
      session,
      userId,
    )

    if (updateManyResult.modifiedCount === 0) throw new AppError('Не удалось обновить задачи.', 500)

    const updatedTasks = await this.repository.findByCriteria<ITask>(
      criteria,
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    /* MOVE */
    const tasksToMove = tasksToUpdate.filter(
      (t) => data.categoryId !== undefined && t.category.toString() !== data.categoryId,
    )

    if (tasksToMove.length > 0) {
      await this.moveTasksByCategories(
        tasksToMove.map((task) => task.id.toString()),
        userId,
        session,
        true,
      )
    }

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: projectProperties<ITask>(updatedTasks, taskPayload),
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedTasksPopulated = await this.getByCriteria(criteria, userId, session)

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
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session, user.timezone),
      )
    }
  }

  private async _executeEditManyTransaction(
    data: TaskEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const taskIds = data.map((d) => d.id)

    const existingTasks = await this.repository.findByCriteria(
      { ids: taskIds },
      session,
      undefined,
      userId,
    )

    if (existingTasks.length === 0) {
      throw new NotFoundError('Задачи для обновления не найдены.')
    }

    const existingMap = new Map(existingTasks.map((t) => [t.id.toString(), t]))

    const taskPayloads: SingleUpdateDTO<SafeUpdateData<ITask>>[] = []
    const tasksBefore: (Partial<ITask> & { id: Types.ObjectId })[] = []
    const movedTaskIds: string[] = []

    for (const dto of data) {
      const task = existingMap.get(dto.id)
      if (!task) continue

      const taskPayload = await this.prepareTaskEditManyPayload(dto, [task], timezone, isDryRun)
      const taskBefore = projectProperties<ITask>([task], taskPayload)[0]

      tasksBefore.push(taskBefore)
      taskPayloads.push(taskPayload)

      const isMoving = dto.categoryId !== undefined && task.category.toString() !== dto.categoryId
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
        userId,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    const updatedTasksResult = await this.repository.bulkUpdate(taskPayloads, userId, session)

    if (!updatedTasksResult || updatedTasksResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить задачи.', 500)
    }

    const updatedTasks = await this.repository.findByCriteria(
      { ids: taskPayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    /** MOVE */
    if (movedTaskIds.length > 0) {
      await this.moveTasksByCategories(movedTaskIds, userId, session, true)
    }

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
      userId,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    const updatedTasksPopulated = await this.getByCriteria(
      { ids: taskPayloads.map((p) => p.id.toString()) },
      userId,
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
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(
        data,
        userId,
        externalSession,
        user.timezone,
        isDryRun,
      )
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session, user.timezone, isDryRun),
      )
    }
  }

  public async moveTasksByCategories(
    taskIds: string[],
    userId: Types.ObjectId,
    session: ClientSession,
    isRerank = false,
  ) {
    const tasks = await this.repository.findByCriteria(
      { ids: taskIds },
      session,
      {
        sort: { rank: 1 },
      },
      userId,
    )
    if (!tasks.length) return

    const categoryIds = [...new Set(tasks.map((t) => t.category))]

    const [categories, lastRanksArray] = await Promise.all([
      this.categoryService.getByCriteria(
        { ids: categoryIds.map((id) => id.toString()) },
        userId,
        session,
      ),
      this.repository.getLastRanksByParents(categoryIds, 'category', userId, session),
    ])

    const categoryMap = new Map(categories.map((c) => [c.id.toString(), c]))

    // 3. Индексируем последние ранги для быстрого доступа O(1)
    const lastRankMap = new Map<string, string>()
    lastRanksArray.forEach((r) => {
      lastRankMap.set(r.parentId.toString(), r.rank)
    })

    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<ITask>>[] = []

    for (const task of tasks) {
      const catIdStr = task.category.toString()
      const category = categoryMap.get(catIdStr)

      if (!category) continue

      const update: SingleUpdateDTO<SafeUpdateData<ITask>> = {
        id: task.id,
        category: category.id,
        board: category.board.id,
        workspace: category.workspace.id,
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
      return await this.repository.bulkUpdate(bulkUpdates, userId, session)
    }

    return null
  }

  public async moveTasksByBoards(
    taskIds: string[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const tasks = await this.repository.findByCriteria({ ids: taskIds }, session, undefined, userId)
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
      return await this.repository.bulkUpdate(bulkUpdates, userId, session)
    }

    return null
  }

  private async _executeDeleteTransaction(
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<null>> {
    const tasksToDelete = await this.repository.findByCriteria(criteria, session, undefined, userId)

    if (tasksToDelete.length === 0) {
      throw new NotFoundError('Задачи для удаления не найдены.')
    }

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.DELETE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksToDelete,
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

    return {
      data: null,
      logId: log.id,
    }
  }

  public async delete(
    criteria: ITaskCriteria,
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
    criteria: ITaskCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

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
      userId,
      session,
    )

    if (isDryRun) {
      return {
        data: [],
        logId: log.id,
      }
    }

    const updateResult = await this.repository.updateManyByCriteria(criteria, data, session, userId)

    if (!updateResult || updateResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить задачи.', 500)

    const sideEffects: Promise<any>[] = []

    await Promise.all(sideEffects)

    const updatedTasksPopulated = await this.getByCriteria(
      { ids: tasksToProcess.map((t) => t.id.toString()) },
      userId,
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
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
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
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
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
      userId,
    )

    if (tasksToClone.length === 0) throw new NotFoundError('Задачи для клонирования не найдены.')

    const tasksGrouppedByCategory: Map<string, (ITask & { embeddings: number[] })[]> = new Map()
    tasksToClone.forEach((task) => {
      const categoryId = task.category.toString()

      if (!tasksGrouppedByCategory.has(categoryId)) {
        tasksGrouppedByCategory.set(categoryId, [])
      }

      tasksGrouppedByCategory.get(categoryId)!.push(task)
    })

    const uniqueCategoryIds = [...new Set(tasksToClone.map((t) => t.category))]
    const lastRanksArray = await this.repository.getLastRanksByParents(
      uniqueCategoryIds,
      'category',
      userId,
      session,
    )
    const lastRankMap = new Map<string, string>()
    lastRanksArray.forEach((r) => {
      lastRankMap.set(r.parentId.toString(), r.rank)
    })

    const transformedTasks: ITaskCreatePayload[] = []

    for (const [categoryId, tasks] of tasksGrouppedByCategory) {
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        const id = tempIds[i] || undefined

        const lastRankInMap = lastRankMap.get(categoryId)
        let nextRank: string

        if (lastRankInMap) {
          nextRank = LexoRank.parse(lastRankInMap).genNext().toString()
        } else {
          nextRank = LexoRank.middle().toString()
        }

        lastRankMap.set(categoryId, nextRank)

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
        userId,
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
      userId,
      session,
    )

    const clonedTasksPopulated = await this.getByCriteria(
      { ids: newTasks.map((t) => t.id.toString()) },
      userId,
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
    const userId = user.id

    if (externalSession) {
      return this._executeCloneTransaction(criteria, userId, externalSession, isDryRun, tempIds)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, userId, session, isDryRun, tempIds),
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

  private async _executeMoveTransaction(
    dto: TaskMoveDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const { beforeId, afterId, id, newCategoryId } = dto

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
      if (newCategoryId) {
        const lastRankData = await this.repository.getLastRanksByParents(
          [new Types.ObjectId(newCategoryId)],
          'category',
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

    if (newCategoryId) {
      const [category] = await this.categoryService.getByCriteria(
        { id: newCategoryId },
        user.id,
        session,
      )
      if (!category) throw new NotFoundError('Категория не найдена.')

      updateData.category = category.id
      updateData.board = category.board.id
      updateData.workspace = category.workspace.id
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

  public async cloneTasksByCategories(
    categoryIdsMap: Map<
      string,
      {
        categoryId: Types.ObjectId
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ITask[]>> {
    const sourceTasks: (ITask & { embeddings: number[] })[] = await this.repository.findByCriteria(
      {
        categoryIds: Array.from(categoryIdsMap.keys()),
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
      const categoryData = categoryIdsMap.get(task.category.toString())

      if (!categoryData) {
        throw new NotFoundError('Категория для клонирования не найдена.')
      }

      return {
        ...task,
        category: categoryData.categoryId,
        board: categoryData.boardId,
        workspace: categoryData.workspaceId,
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
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession,
    isEmbeddingsNeeded = true,
  ): Promise<ITaskCreatePayload> {
    const taskName = data.name.trim()

    const embeddings = isEmbeddingsNeeded ? await this.embeddingService.getEmbeddings(taskName) : []

    let taskRank = LexoRank.middle().toString()

    /* RANKING */
    const lastTasksInCategory = await this.repository.findByCriteria(
      { categoryId: data.categoryId },
      session,
      { sort: { rank: -1 }, limit: 1 },
      userId,
    )
    if (lastTasksInCategory.length > 0) {
      const lastTask = lastTasksInCategory[0]
      const lastRank = LexoRank.parse(lastTask.rank)

      taskRank = lastRank.genNext().toString()
    }

    const taskPayload: ITaskCreatePayload = {
      id: data.id,
      name: taskName,
      description: data.description || '',
      dueDate: data.dueDate || '',
      dueHours: data.dueHours,
      dueMinutes: data.dueMinutes,
      color: data.color
        ? {
            value: data.color.value,
            tone: data.color.tone,
          }
        : undefined,
      isCompleted: data.isCompleted,
      workspace: Types.ObjectId.createFromHexString(data.workspaceId),
      board: Types.ObjectId.createFromHexString(data.boardId),
      category: Types.ObjectId.createFromHexString(data.categoryId),
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
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession,
    isDryRun = false,
  ): Promise<ITaskCreatePayload[]> {
    const tasksPayloads: ITaskCreatePayload[] = []
    const tasksGroupedByCategory: { [key: string]: TaskDTO[] } = {}
    const uniqueCategoryIds = Array.from(
      new Set(data.map((task) => new Types.ObjectId(task.categoryId))),
    )

    data.forEach((task) => {
      const categoryId = task.categoryId
      if (!tasksGroupedByCategory[categoryId]) {
        tasksGroupedByCategory[categoryId] = []
      }

      tasksGroupedByCategory[categoryId].push(task)
    })

    const taskNames = Array.from(new Set(data.map((task) => task.name.trim())))
    const embeddingsMap: { [key: string]: number[] } = {}

    if (!isDryRun) {
      const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(taskNames)
      taskNames.forEach((name, index) => {
        embeddingsMap[name] = embeddingsArray[index]
      })
    }

    const lastRanksByCategories = await this.repository.getLastRanksByParents(
      uniqueCategoryIds,
      'category',
      userId,
      session,
    )

    for (const [categoryId, tasks] of Object.entries(tasksGroupedByCategory)) {
      let lastRank = LexoRank.middle()

      const lastRankData = lastRanksByCategories.find((r) => r.parentId.toString() === categoryId)
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

          workspace: new Types.ObjectId(task.workspaceId),
          board: new Types.ObjectId(task.boardId),
          category: new Types.ObjectId(task.categoryId),

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
    if (data.categoryId) {
      taskPayload.category = Types.ObjectId.createFromHexString(data.categoryId)
    }
    if (data.boardId) {
      taskPayload.board = Types.ObjectId.createFromHexString(data.boardId)
    }
    if (data.workspaceId) {
      taskPayload.workspace = Types.ObjectId.createFromHexString(data.workspaceId)
    }

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
    timezone: string,
  ): Promise<SafeUpdateData<ITask>> {
    const taskPayload: SafeUpdateData<ITask> = {
      ...data,
    }

    await this._prepareMainEditFields(data, taskPayload, tasksToUpdate, timezone)

    return taskPayload
  }

  public async prepareTaskEditManyPayload(
    data: TaskEditDTO,
    tasksToUpdate: ITask[],
    timezone: string,
    isDryRun: boolean = false,
  ): Promise<SingleUpdateDTO<SafeUpdateData<ITask>>> {
    const { id, ...rest } = data

    const taskPayload: SingleUpdateDTO<SafeUpdateData<ITask>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    await this._prepareMainEditFields(rest, taskPayload, tasksToUpdate, timezone, isDryRun)

    return taskPayload
  }
}
