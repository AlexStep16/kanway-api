import { ITaskRaw } from '@entities/ITaskRaw.ts'
import TaskRepository from '@repositories/TaskRepository.ts'
import { TaskDTO } from '@application/dtos/TaskDTO.ts'
import mongoose, { ClientSession, DeleteResult, Types, UpdateWriteOpResult } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { ITaskCriteria } from '@criterias/ITaskCriteria.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { IUser } from '@entities/IUser.ts'
import { ITask } from '@entities/ITask.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TASK_COLORS, TASK_COLORS_MAP } from '@/constants/TASK_COLORS.ts'
import { CategoryService } from '@application/services/CategoryService.ts'

import dayjs from 'dayjs'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '../interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'

import chroma from 'chroma-js'
import { BASE_COLORS } from '@/constants/BASE_COLORS.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { BoardService } from '@application/services/BoardService.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { LifecycleDTO } from '@dtos/LifecycleDTO.ts'
import { ITaskPopulated } from '@interfaces/ITaskPopulated.ts'
import { BaseService } from '@application/services/BaseService.ts'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.ts'
import { ITaskCreatePayload } from '../interfaces/ITaskCreatePayload.ts'

const MAX_RETRIES = 3

type ReorderServiceType = ReorderService<
  ITask,
  ITaskRaw,
  ITaskCriteria,
  ITaskPopulated,
  ITaskCreatePayload
>

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
  protected reorderService: ReorderServiceType
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    taskRepository: TaskRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderServiceType,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
  ) {
    super(taskRepository)

    this.repository = taskRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
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

    const sideEffects: Promise<any>[] = []

    /* REORDER */
    if (data.order !== undefined) {
      sideEffects.push(this.reorderService.reorder('category', [newTask], userId, session))
    }

    sideEffects.push(...this._updateTasksParentCounters([newTask], userId, session))

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: [newTask],
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

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
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
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
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksPayload = await this.prepareTasksCreationPayload(data, userId, timezone, session)

    /* CREATE */
    const newTasks = await this.repository.createMany(tasksPayload, session)

    const sideEffects: Promise<any>[] = []

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      sideEffects.push(this.reorderService.reorder('category', newTasks, userId, session))
    }

    const newTasksPopulated = await this.getByCriteria(
      { ids: newTasks.map((t) => t.id.toString()) },
      userId,
      session,
    )

    newTasksPopulated.forEach((nt, index) => {
      nt.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity
    })

    sideEffects.push(...this._updateTasksParentCounters(newTasks, userId, session))

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: newTasks,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    return {
      data: newTasksPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: TaskDTO[],
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateManyTransaction(data, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session, user.timezone),
      )
    }
  }

  private async _executeEditTransaction(
    data: TaskEditDTO,
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
      await this.regenerateReferencesByCategories(
        tasksToMove.map((task) => task.id.toString()),
        userId,
        session,
      )

      const movedIds = tasksToMove.map((t) => t.id.toString())
      const tasksAfterMove = updatedTasks.filter((t) => movedIds.includes(t.id.toString()))

      sideEffects.push(
        ...this._updateTasksParentCountersWithOld(tasksToMove, tasksAfterMove, userId, session),
      )
    }

    /* REORDER */
    const tasksToReorder = tasksToUpdate.filter(
      (t) => data.order !== undefined && t.order !== data.order,
    )

    const tasksToMoveToEnd = tasksToUpdate.filter(
      (t) => data.order == null && tasksToMove.includes(t),
    )

    if (tasksToReorder.length > 0 || tasksToMoveToEnd.length > 0) {
      sideEffects.push(
        this.reorderService.reorder(
          'category',
          [
            ...tasksToReorder,
            ...tasksToMoveToEnd.map((t) => ({
              ...t,
              order: t.order + 99999,
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
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: updatedTasks,
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
    data: TaskEditDTO,
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
    const tasksBefore: Partial<ITask>[] = []
    const movedTaskIds: string[] = []
    const reorderTaskIds = new Set<string>()
    const moveToEndIds = new Set<string>()

    for (const dto of data) {
      const task = existingMap.get(dto.id)
      if (!task) continue

      const taskPayload = await this.prepareTaskEditPayload(dto, [task], timezone)

      tasksBefore.push(projectProperties<ITask>([task], taskPayload)[0])
      taskPayloads.push(taskPayload)

      const isMoving = dto.categoryId !== undefined && task.category.toString() !== dto.categoryId
      if (isMoving) {
        movedTaskIds.push(dto.id)
      }

      if (dto.order !== undefined && task.order !== dto.order) {
        reorderTaskIds.add(dto.id)
      } else if (dto.order == null && isMoving) {
        reorderTaskIds.add(dto.id)
        moveToEndIds.add(dto.id)
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
      await this.regenerateReferencesByCategories(movedTaskIds, userId, session)

      const tasksToMove = existingTasks.filter((t) => movedTaskIds.includes(t.id.toString()))
      const tasksAfterMove = updatedTasks.filter((t) => movedTaskIds.includes(t.id.toString()))

      sideEffects.push(
        ...this._updateTasksParentCountersWithOld(tasksToMove, tasksAfterMove, userId, session),
      )
    }

    /** REORDER */
    if (reorderTaskIds.size > 0) {
      const tasksToReorder = updatedTasks
        .filter((t) => reorderTaskIds.has(t.id.toString()))
        .map((t) => {
          if (moveToEndIds.has(t.id.toString())) {
            return { ...t, order: t.order + 99999 }
          }
          return t
        })

      sideEffects.push(this.reorderService.reorder('category', tasksToReorder, userId, session))
    }

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: updatedTasks,
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
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session, user.timezone),
      )
    }
  }

  public async regenerateReferencesByCategories(
    taskIds: string[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const tasks = await this.repository.findByCriteria({ ids: taskIds }, session, undefined, userId)
    if (!tasks.length) return

    const categoryIds = [...new Set(tasks.map((t) => t.category.toString()))]

    const categories = await this.categoryService.getByCriteria({
      ids: categoryIds,
    })

    const categoryMap = new Map(categories.map((c) => [c.id.toString(), c]))

    const bulkUpdates = tasks.reduce(
      (acc, task) => {
        const category = categoryMap.get(task.category.toString())

        if (category) {
          acc.push({
            id: task.id,
            board: category.board.id,
            workspace: category.workspace.id,
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

  public async regenerateReferencesByBoards(
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
  ): Promise<void> {
    const tasksToDelete = await this.repository.findByCriteria(criteria, session, undefined, userId)

    if (tasksToDelete.length === 0) {
      throw new NotFoundError('Задачи для удаления не найдены.')
    }

    const uniqueCategoryIds = [...new Set(tasksToDelete.map((t) => t.category.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    await this.repository.deleteMany(criteria, userId, session)

    const updateCountersPromises = this._updateTasksParentCounters(tasksToDelete, userId, session)

    await Promise.all([
      ...updateCountersPromises,

      this.reorderService.reorderByParentIds(uniqueCategoryIds, 'category', userId, session),
    ])
  }

  public async delete(
    criteria: ITaskCriteria,
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
    criteria: ITaskCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession,
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

    const updateResult = await this.repository.updateManyByCriteria(criteria, data, session, userId)

    if (!updateResult || updateResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить задачи.', 500)

    const sideEffects: Promise<any>[] = []

    /* REORDER */
    sideEffects.push(
      this.reorderService.reorderByParentIds(
        tasksToProcess.map((c) => c.board),
        'category',
        userId,
        session,
      ),
    )

    /** UPDATE COUNTERS */
    sideEffects.push(...this._updateTasksParentCounters(tasksToProcess, userId, session))

    const entitiesAfter = tasksToProcess.map((task) => ({
      ...task,
      isDeleted: data.isDeleted,
    }))

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksToProcess,
        entitiesAfter: entitiesAfter,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

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
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
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
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
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
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const tasksToClone: (ITask & { embeddings: number[] })[] = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
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

    const transformedTasks: Omit<ITask & { embeddings: number[] }, 'id'>[] = []

    for (const [categoryId, tasks] of tasksGrouppedByCategory) {
      const categoryTasks = tasksToClone.filter((t) => t.category.toString() === categoryId)

      let currentMaxOrder = categoryTasks.reduce((max, t) => (t.order > max ? t.order : max), 9999)

      for (const task of tasks) {
        const cleanTask = {
          ...task,
          id: undefined,
          order: ++currentMaxOrder,
          name: `${task?.name}`,
        }

        transformedTasks.push(cleanTask)
      }
    }

    const newTasks = await this.repository.createMany(transformedTasks, session)

    /* REORDER */
    await this.reorderService.reorderByParentIds(
      newTasks.map((t) => t.category),
      'category',
      userId,
      session,
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: newTasks,
        dependencies: [],
      },
      userId,
      session,
    )

    await Promise.all([logPromise, ...this._updateTasksParentCounters(newTasks, userId, session)])

    const log = await logPromise

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
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
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

    const before = log.entitiesBefore as (Partial<ITask> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<ITask> & { id: Types.ObjectId })[]

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
      affectedTaskIds: [...new Set([...idsBefore, ...idsAfter])],
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
      { categoryIds: Array.from(categoryIdsMap.keys()) },
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
        _id: undefined,
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

  private async prepareTaskCreationPayload(
    data: TaskDTO,
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession,
  ): Promise<ITaskCreatePayload> {
    const taskName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(taskName)

    const taskPayload: ITaskCreatePayload = {
      name: taskName,
      description: data.description || '',
      dueDate: data.dueDate || '',
      dueHours: data.dueHours,
      dueMinutes: data.dueMinutes,
      color: data.color,
      isCompleted: data.isCompleted,
      workspace: Types.ObjectId.createFromHexString(data.workspaceId),
      board: Types.ObjectId.createFromHexString(data.boardId),
      category: Types.ObjectId.createFromHexString(data.categoryId),
      tags: data.tags ? data.tags.map((tag) => tag.toString()) : [],
      order: data.order || 1,
      embeddings,
      userId,
    }

    this.prepareTaskMainFields(data, taskPayload, timezone)

    if (data.order === undefined) {
      const lastOrderGroupped = await this.repository.getLastOrderGroupedByParents(
        [Types.ObjectId.createFromHexString(data.categoryId)],
        'category',
        userId,
        session,
      )

      taskPayload.order = lastOrderGroupped.length > 0 ? lastOrderGroupped[0].lastOrder + 1 : 1
    }

    return taskPayload
  }

  private async prepareTasksCreationPayload(
    data: TaskDTO[],
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession,
  ): Promise<ITaskCreatePayload[]> {
    const tasksPayloads: ITaskCreatePayload[] = []
    const tasksGroupedByCategory: { [key: string]: TaskDTO[] } = {}

    data.forEach((task) => {
      const categoryId = task.categoryId
      if (!tasksGroupedByCategory[categoryId]) {
        tasksGroupedByCategory[categoryId] = []
      }

      tasksGroupedByCategory[categoryId].push(task)
    })

    const grouppedTasksCount = await this.repository.getLastOrderGroupedByParents(
      Object.keys(tasksGroupedByCategory).map(Types.ObjectId.createFromHexString),
      'category',
      userId,
      session,
    )

    const taskNames = Array.from(new Set(data.map((task) => task.name.trim())))
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(taskNames)
    const embeddingsMap: { [key: string]: number[] } = {}
    taskNames.forEach((name, index) => {
      embeddingsMap[name] = embeddingsArray[index]
    })

    const countMap = new Map(
      grouppedTasksCount.map((entry) => [entry._id.toString(), entry.lastOrder]),
    )

    for (const [categoryId, tasks] of Object.entries(tasksGroupedByCategory)) {
      let currentOrder = countMap.get(categoryId) || 1

      for (const task of tasks) {
        const taskName = task.name.trim()

        const orderToSave = task.order ?? ++currentOrder

        const taskPayload: ITaskCreatePayload = {
          name: taskName,
          description: task.description ?? '',
          dueDate: task.dueDate ?? '',
          dueHours: task.dueHours,
          dueMinutes: task.dueMinutes,
          color: task.color,
          isCompleted: task.isCompleted,

          workspace: new Types.ObjectId(task.workspaceId),
          board: new Types.ObjectId(task.boardId),
          category: new Types.ObjectId(task.categoryId),

          tags: task.tags?.map((tag) => tag.toString()) ?? [],

          order: orderToSave,
          embeddings: embeddingsMap[taskName],
          userId,
        }

        this.prepareTaskMainFields(task, taskPayload, timezone)

        tasksPayloads.push(taskPayload)
      }
    }

    return tasksPayloads
  }

  private prepareTaskMainFields(
    data: TaskDTO | TaskEditDTO,
    taskPayload: ITaskCreatePayload | SingleUpdateDTO<SafeUpdateData<ITask>>,
    timezone: string,
  ) {
    if (data.color && TASK_COLORS_MAP[data.color]) {
      taskPayload.colorName = TASK_COLORS_MAP[data.color]
    }

    if (data.dueDate && data.dueHours != null && data.dueMinutes != null) {
      const collectedDateTime = `${data.dueDate}T${data.dueHours}:${data.dueMinutes}`
      const utcDueDate = dayjs.tz(collectedDateTime, timezone).utc()

      taskPayload.dueDate = utcDueDate.format('YYYY-MM-DD')
      taskPayload.dueHours = utcDueDate.hour()
      taskPayload.dueMinutes = utcDueDate.minute()
    }
  }

  private async prepareTaskEditPayload(
    data: TaskEditDTO,
    tasksToUpdate: ITask[],
    timezone: string,
  ): Promise<SingleUpdateDTO<SafeUpdateData<ITask>>> {
    const { id, ...rest } = data

    const taskPayload: SingleUpdateDTO<SafeUpdateData<ITask>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

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

    if (data.name && tasksToUpdate.length > 0) {
      const needEmbeddingsUpdate = tasksToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const taskName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(taskName)

        taskPayload.embeddings = embeddings
      }
    }

    return taskPayload
  }

  public getNearestColor(hexColor: string) {
    let closestColor: (typeof TASK_COLORS)[number] | (typeof TASK_COLORS)[number] = BASE_COLORS[3]
    let minDistance = Infinity

    for (const colorValue in TASK_COLORS_MAP) {
      const distance = chroma.distance(hexColor, colorValue)

      if (distance < minDistance) {
        minDistance = distance
        closestColor = colorValue as (typeof TASK_COLORS)[number]
      }
    }

    return closestColor
  }

  private _updateTasksParentCountersWithOld(
    oldTasks: ITask[],
    newTasks: ITask[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const sideEffects: Promise<any>[] = []

    const affectedCategories = new Set<string>()
    const affectedBoards = new Set<string>()
    const affectedWorkspaces = new Set<string>()

    oldTasks.forEach((t) => {
      affectedCategories.add(t.category.toString())
      affectedBoards.add(t.board.toString())
      affectedWorkspaces.add(t.workspace.toString())
    })

    newTasks.forEach((t) => {
      affectedCategories.add(t.category.toString())
      affectedBoards.add(t.board.toString())
      affectedWorkspaces.add(t.workspace.toString())
    })

    sideEffects.push(
      this.categoryService.updateTasksCount(
        Array.from(affectedCategories).map((id) => new Types.ObjectId(id)),
        userId,
        session,
      ),
      this.boardService.updateTasksCount(
        Array.from(affectedBoards).map((id) => new Types.ObjectId(id)),
        userId,
        session,
      ),
      this.workspaceService.updateTasksCount(
        Array.from(affectedWorkspaces).map((id) => new Types.ObjectId(id)),
        userId,
        session,
      ),
    )

    return sideEffects
  }

  private _updateTasksParentCounters(
    tasks: ITask[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const uniqueCategoryIds = [...new Set(tasks.map((t) => t.category.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    const uniqueBoardIds = [...new Set(tasks.map((t) => t.board.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    const uniqueWorkspaceIds = [...new Set(tasks.map((t) => t.workspace.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    return [
      this.categoryService.updateTasksCount(uniqueCategoryIds, userId, session),
      this.boardService.updateTasksCount(uniqueBoardIds, userId, session),
      this.workspaceService.updateTasksCount(uniqueWorkspaceIds, userId, session),
    ]
  }

  public getTasksCountByCategories(
    categoryIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(categoryIds, 'category', userId, session)
  }

  public getTasksCountByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(boardIds, 'board', userId, session)
  }

  public getTasksCountByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(workspaceIds, 'workspace', userId, session)
  }
}
