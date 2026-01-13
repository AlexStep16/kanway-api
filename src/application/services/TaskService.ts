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
import { ITasksResponse } from '@/application/interfaces/ITasksResponse.ts'

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
  protected reorderService: ReorderService<ITask, ITaskRaw, ITaskCriteria>
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    taskRepository: TaskRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<ITask, ITaskRaw, ITaskCriteria>,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService
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
      500
    )
  }

  private async _executeCreateTransaction(
    data: TaskDTO,
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    let reorderedTasks: ITask[] = []

    const finalEntitiesMap = new Map<string, ITask>()
    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const taskPayload = await this.prepareTaskCreationPayload(data, userId, timezone)

    /* CREATE */
    const newTask = await this.repository.create(taskPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedTasks = await this.reorderService.reorder('category', [newTask], userId, session)

      reorderedTasks.forEach((reorderedTask) => {
        finalEntitiesMap.set(reorderedTask.id.toString(), reorderedTask)
      })
    }

    newTask.tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

    finalEntitiesMap.set(newTask.id.toString(), newTask)

    const finalEntities = Array.from(finalEntitiesMap.values())
    const finalEntitiesPopulated = await this.getByCriteria(
      { ids: finalEntities.map((t) => t.id.toString()) },
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: [newTask],
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: finalEntitiesPopulated,
      logId: log.id,
    }
  }

  public async create(
    data: TaskDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateTransaction(data, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, userId, session, user.timezone)
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: TaskDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    let reorderedTasks: ITask[] = []

    const finalEntitiesMap = new Map<string, ITask>()

    const tasksPayload = await this.prepareTasksCreationPayload(data, userId, timezone, session)

    /* CREATE */
    const newTasks = await this.repository.createMany(tasksPayload, session)

    newTasks.forEach((nt, index) => {
      nt.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity

      finalEntitiesMap.set(nt.id.toString(), nt)
    })

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      reorderedTasks = await this.reorderService.reorder('category', newTasks, userId, session)
    }

    if (reorderedTasks.length > 0) {
      reorderedTasks.forEach((reorderedTask) => {
        finalEntitiesMap.set(reorderedTask.id.toString(), reorderedTask)
      })
    }

    const finalEntities = Array.from(finalEntitiesMap.values())
    const finalEntitiesPopulated = await this.getByCriteria(
      { ids: finalEntities.map((t) => t.id.toString()) },
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: newTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: finalEntitiesPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: TaskDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateManyTransaction(data, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session, user.timezone)
      )
    }
  }

  private async _executeEditTransaction(
    data: TaskEditDTO,
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    let reorderedTasks: ITask[] = []

    const finalEntitiesMap = new Map<string, ITask>()
    const tasksToUpdate = await this.repository.findByCriteria(criteria, session)

    if (tasksToUpdate.length === 0) throw new NotFoundError('Задачи для обновления не найдены.')

    const taskPayload = await this.prepareTaskEditPayload(data, tasksToUpdate, timezone)
    const tasksBefore = projectProperties<ITask>(tasksToUpdate, taskPayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      taskPayload,
      session,
      userId
    )
    const updatedEntities = await this.repository.findByCriteria<ITask>(criteria, session)

    if (updateManyResult.modifiedCount === 0) throw new AppError('Не удалось обновить задачи.', 500)

    updatedEntities.forEach((task) => {
      finalEntitiesMap.set(task.id.toString(), task)
    })

    /* MOVE */
    const tasksToMove = tasksToUpdate.filter(
      (t) => data.categoryId !== undefined && t.category.toString() !== data.categoryId
    )

    if (tasksToMove.length > 0) {
    }

    /* REORDER */
    const tasksToReorder = tasksToUpdate.filter((t) => data.order != null && t.order !== data.order)

    const tasksToMoveToEnd = tasksToUpdate.filter(
      (t) => data.order == null && tasksToMove.includes(t)
    )

    for (const taskToMoveToEnd of tasksToMoveToEnd) {
      taskToMoveToEnd.order += 99999 // Move to end before reordering
    }

    if (tasksToReorder.length > 0) {
      reorderedTasks = await this.reorderService.reorder(
        'category',
        [...tasksToReorder, ...tasksToMoveToEnd],
        userId,
        session
      )

      reorderedTasks.forEach((reorderedTask) => {
        finalEntitiesMap.set(reorderedTask.id.toString(), reorderedTask)
      })
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: updatedEntities,
        dependencies: [],
      },
      userId,
      session
    )

    const finalEntitiesPopulated = await this.getByCriteria(
      { ids: finalEntities.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: finalEntitiesPopulated,
      logId: log.id,
    }
  }

  public async edit(
    data: TaskEditDTO,
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session, user.timezone)
      )
    }
  }

  private async _executeEditManyTransaction(
    data: TaskEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const taskIdsToReorder: Set<string> = new Set()
    const taskIdsToMoveToEnd: Set<string> = new Set()
    const tasksPayload: SingleUpdateDTO<SafeUpdateData<ITask>>[] = []
    const tasksPayloadToMove: SingleUpdateDTO<SafeUpdateData<ITask>>[] = []

    let reorderedTasks: ITask[] = []

    const finalEntitiesMap = new Map<string, ITask>()
    const tasksBefore: Partial<ITask>[] = []

    const taskIds = data.map((d) => d.id)

    const existingTasks: ITask[] = await this.repository.findByCriteria(
      { ids: taskIds },
      session,
      undefined,
      userId
    )

    if (existingTasks.length === 0) throw new NotFoundError('Задачи для обновления не найдены.')

    for (const dto of data) {
      const task = existingTasks.find((t) => t.id.toString() === dto.id)

      if (!task) continue

      const taskPayload = await this.prepareTaskEditPayload(dto, [task], timezone)
      tasksBefore.push(projectProperties<ITask>([task], taskPayload)[0])

      if (dto.categoryId && task.category.toString() !== dto.categoryId) {
        tasksPayloadToMove.push(taskPayload)
      }

      if (dto.order != null && task.order !== dto.order) {
        taskIdsToReorder.add(dto.id)
      } else if (dto.order == null && tasksPayloadToMove.includes(taskPayload)) {
        taskIdsToReorder.add(dto.id)
        taskIdsToMoveToEnd.add(dto.id)
      }

      tasksPayload.push(taskPayload)
    }

    /* BULK UPDATE */
    const updateTasksResult = await this.repository.bulkUpdate(tasksPayload, userId, session)

    if (!updateTasksResult || updateTasksResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить задачи.', 500)

    const updatedTasks = await this.repository.findByCriteria(
      { ids: tasksPayload.map((t) => t.id.toString()) },
      session,
      undefined,
      userId
    )

    updatedTasks.forEach((task) => {
      finalEntitiesMap.set(task.id.toString(), task)
    })

    /* MOVE */
    if (tasksPayloadToMove.length > 0) {
    }

    /* REORDER */
    if (taskIdsToReorder.size > 0) {
      for (const taskId of taskIdsToMoveToEnd) {
        const taskToMoveToEnd = updatedTasks.find((t) => t.id.toString() === taskId)

        if (taskToMoveToEnd) {
          taskToMoveToEnd.order += 99999 // Move to end before reordering
        }
      }

      const tasksToReorder = updatedTasks.filter((ut) => taskIdsToReorder.has(ut.id.toString()))

      if (tasksToReorder.length > 0) {
        reorderedTasks = await this.reorderService.reorder(
          'category',
          tasksToReorder,
          userId,
          session
        )

        reorderedTasks.forEach((reorderedTask) => {
          finalEntitiesMap.set(reorderedTask.id.toString(), reorderedTask)
        })
      }
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    const finalEntitiesPopulated = await this.getByCriteria(
      { ids: finalEntities.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: finalEntitiesPopulated,
      logId: log.id,
    }
  }

  public async editMany(
    data: TaskEditDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session, user.timezone)
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<ITaskPopulated[]> {
    let reorderedTasks: ITask[] = []

    const tasksToDelete = await this.repository.findByCriteria(criteria, session)
    if (tasksToDelete.length === 0) throw new NotFoundError('Задачи для удаления не найдены.')

    await this.repository.deleteMany(criteria, userId, session)

    // TODO: Update counters

    /* REORDER */
    reorderedTasks = await this.reorderService.reorderByParentIds(
      tasksToDelete.map((t) => t.category),
      'category',
      userId,
      session
    )

    await session.commitTransaction()

    const populatedDeletedTasks = await this.getByCriteria(
      { ids: tasksToDelete.map((t) => t.id.toString()) },
      userId,
      session
    )

    return [...populatedDeletedTasks]
  }

  public async delete(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<ITaskPopulated[]> {
    const userId = user.id

    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeLifecycleTransaction(
    criteria: ITaskCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ITasksResponse>> {
    let reorderedTasks: ITask[] = []

    const finalEntitiesMap = new Map<string, ITask>()

    const tasksToProcess = await this.repository.findByCriteria(criteria, session)

    // TODO: Update Counters

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

    const updatedTasks = await this.repository.findByCriteria<ITask>(
      criteria,
      session,
      undefined,
      userId
    )

    updatedTasks.forEach((task) => {
      finalEntitiesMap.set(task.id.toString(), task)
    })

    /* REORDER */
    reorderedTasks = await this.reorderService.reorderByParentIds(
      tasksToProcess.map((c) => c.board),
      'category',
      userId,
      session
    )

    reorderedTasks.forEach((reorderedTask) => {
      finalEntitiesMap.set(reorderedTask.id.toString(), reorderedTask)
    })

    const finalEntities = Array.from(finalEntitiesMap.values())
    const finalEntitiesPopulated = await this.getByCriteria(
      { ids: finalEntities.map((t) => t.id.toString()) },
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksToProcess,
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: {
        tasks: finalEntitiesPopulated,
      },
      logId: log.id,
    }
  }

  public async archive(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITasksResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, userId, session)
      )
    }
  }

  public async recover(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITasksResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, userId, session)
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ITask[]>> {
    const tasksToClone: (ITask & { embeddings: number[] })[] = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId
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

      let currentMaxOrder = categoryTasks.reduce((max, t) => (t.order > max ? t.order : max), 0)

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

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: newTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: [...newTasks],
      logId: log.id,
    }
  }

  public async clone(
    criteria: ITaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITask[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCloneTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, userId, session)
      )
    }
  }

  public async revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession
  ): Promise<IUndoResponse<ITasksResponse>> {
    const entitiesBefore = log.entitiesBefore as (Partial<ITask> & { id: Types.ObjectId })[]
    const entitiesAfter = log.entitiesAfter as ITask[]

    const taskBeforeIds = entitiesBefore.map((e) => e.id.toString())
    const taskAfterIds = entitiesAfter.map((e) => e.id.toString())
    const operationType = log.operationType

    if (operationType === OperationTypesEnum.CREATE) {
      const deleteResult = await this.delete({ ids: taskAfterIds }, user, session)
      const deletedIds = deleteResult.map((t) => t.id.toString())

      const populatedTasks = await this.getByCriteria(
        { ids: [...deleteResult, ...entitiesAfter].map((t) => t.id.toString()) },
        user.id,
        session
      )

      return {
        delete: { tasks: populatedTasks.filter((t) => taskAfterIds.includes(t.id.toString())) },
        update: {
          tasks: populatedTasks.filter((t) => deletedIds.includes(t.id.toString())),
        },
      }
    } else if (operationType === OperationTypesEnum.UPDATE) {
      const entitiesBeforeToEditSchema = entitiesBefore.map((e) => {
        return {
          ...e,
          id: e.id.toString(),
          category: e.category?.toString(),
          board: e.board?.toString(),
          workspace: e.workspace?.toString(),
        }
      })

      const editResult = await this.editMany(entitiesBeforeToEditSchema, user, session)

      return {
        update: { tasks: editResult.data },
      }
    } else if (operationType === OperationTypesEnum.ARCHIVE) {
      const recoverResult = await this.recover({ ids: taskBeforeIds }, user, session)

      return {
        update: { tasks: recoverResult.data.tasks },
      }
    } else if (operationType === OperationTypesEnum.RECOVER) {
      const archiveResult = await this.archive({ ids: taskBeforeIds }, user, session)

      return {
        update: archiveResult.data,
      }
    } else throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
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
    session: ClientSession
  ): Promise<IResponseWithLog<ITask[]>> {
    const sourceTasks: (ITask & { embeddings: number[] })[] = await this.repository.findByCriteria(
      { categoryIds: Array.from(categoryIdsMap.keys()) },
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId
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
      session
    )

    const clonedTasksTransformed = clonedTasks

    return {
      data: clonedTasksTransformed,
      logId: log.id,
    }
  }

  public async deleteTasksByFilter(
    criteria: ITaskCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<DeleteResult> {
    return await this.repository.deleteMany(criteria, userId, session)

    // TODO: Update counters
  }

  public async updateTasksByFilter(
    criteria: ITaskCriteria,
    data: Partial<ITask>,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<UpdateWriteOpResult> {
    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
  }

  public async updateLifecycleTasksByFilter(
    criteria: ITaskCriteria,
    data: SafeUpdateData<ITask>,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<UpdateWriteOpResult> {
    const tasksToProcess = await this.repository.findByCriteria(criteria, session)

    if (tasksToProcess.length === 0) throw new NotFoundError('Задачи не найдены.')

    // TODO: Update Counters

    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
  }

  private async prepareTaskCreationPayload(
    data: TaskDTO,
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession
  ): Promise<ITaskCreatePayload> {
    const taskName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(taskName)

    const taskPayload: ITaskCreatePayload = {
      ...data,
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
        session
      )

      taskPayload.order = lastOrderGroupped.length > 0 ? lastOrderGroupped[0].lastOrder + 1 : 1
    }

    return taskPayload
  }

  private async prepareTasksCreationPayload(
    data: TaskDTO[],
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession
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
      session
    )

    const taskNames = Array.from(new Set(data.map((task) => task.name.trim())))
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(taskNames)
    const embeddingsMap: { [key: string]: number[] } = {}
    taskNames.forEach((name, index) => {
      embeddingsMap[name] = embeddingsArray[index]
    })

    for (const [categoryId, tasks] of Object.entries(tasksGroupedByCategory)) {
      const existingCountEntry = grouppedTasksCount.find(
        (entry) => entry._id.toString() === categoryId
      )
      let newOrder = existingCountEntry ? existingCountEntry.lastOrder : 0

      tasks.forEach((task) => {
        if (task.order === undefined) {
          task.order = ++newOrder
        }
      })

      for (const task of tasks) {
        const taskName = task.name.trim()
        const taskPayload: ITaskCreatePayload = {
          ...task,
          workspace: Types.ObjectId.createFromHexString(task.workspaceId),
          board: Types.ObjectId.createFromHexString(task.boardId),
          category: Types.ObjectId.createFromHexString(task.categoryId),
          tags: task.tags ? task.tags.map((tag) => tag.toString()) : [],
          order: task.order || 1,
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
    timezone: string
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
    timezone: string
  ): Promise<SingleUpdateDTO<SafeUpdateData<ITask>>> {
    const taskPayload: SingleUpdateDTO<SafeUpdateData<ITask>> = {
      ...data,
      id: Types.ObjectId.createFromHexString(data.id),
    }

    if (data.tags) taskPayload.tags = data.tags.map((tag) => tag.toString())

    this.prepareTaskMainFields(data, taskPayload, timezone)

    if (data.name && tasksToUpdate.length > 0) {
      const needEmbeddingsUpdate = tasksToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim()
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
}
