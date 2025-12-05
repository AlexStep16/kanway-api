import { ITaskRaw } from '@entities/ITaskRaw.ts'
import TaskRepository from '@repositories/TaskRepository.ts'
import { TaskDTO } from '@application/dtos/TaskDTO.ts'
import mongoose, { ClientSession, FilterQuery, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { TaskCriteria } from '@criterias/TaskCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { IUser } from '@entities/IUser.ts'
import { ITask } from '@entities/ITask.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TASK_COLORS, TASK_COLORS_MAP } from '@/constants/TASK_COLORS.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { ITasksResponse } from '@/application/interfaces/ITasksResponse.ts'
import { ITaskWithTempClientId } from '@application/interfaces/ITaskWithTempClientId.ts'

import dayjs from 'dayjs'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '../interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'
import chroma from 'chroma-js'

const MAX_RETRIES = 3

export class TaskService
  implements IBaseService<ITask, TaskCriteria, TaskDTO, TaskEditDTO, ITask[], ITasksResponse>
{
  protected repository: TaskRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<ITaskRaw>
  protected categoryService: CategoryService

  constructor(
    taskRepository: TaskRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<ITaskRaw>,
    categoryService: CategoryService
  ) {
    this.repository = taskRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.categoryService = categoryService
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
    throw new Error(
      'Произошла ошибка при выполнении операции после максимального количества попыток.'
    )
  }

  private async _executeCreateTransaction(
    data: TaskDTO,
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string
  ): Promise<IResponseWithLog<ITaskWithTempClientId[]>> {
    let reorderedTasks: ITaskRaw[] = []

    const finalEntitiesMap = new Map<string, ITask>()
    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const taskPayload = await this.prepareTaskCreationPayload(data, userId, timezone)

    /* CREATE */
    const newTask = await this.repository.create(taskPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedTasks = await this.reorderService.reorder('category_id', [newTask], userId, session)
    }

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

    const toServerCaseTask = toServerCaseKeys<ITaskWithTempClientId>(newTask)
    toServerCaseTask.tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

    finalEntitiesMap.set(newTask._id.toString(), toServerCaseTask)

    if (reorderedTasks.length > 0) {
      reorderedTasks.forEach((reorderedTask) => {
        finalEntitiesMap.set(reorderedTask._id.toString(), toServerCaseKeys<ITask>(reorderedTask))
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log[0].id,
    }
  }

  public async create(
    data: TaskDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITaskWithTempClientId[]>> {
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
  ): Promise<IResponseWithLog<ITaskWithTempClientId[]>> {
    let reorderedTasks: ITaskRaw[] = []

    const finalEntitiesMap = new Map<string, ITask>()

    const tasksPayload = await this.prepareTasksCreationPayload(data, userId, timezone, session)

    /* CREATE */
    const newTasks = await this.repository.createMany(tasksPayload, session)

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      reorderedTasks = await this.reorderService.reorder('category_id', newTasks, userId, session)
    }

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

    const toServerCaseKeysTasks = newTasks.map((nt, index) => {
      const transformed = toServerCaseKeys<ITaskWithTempClientId>(nt)

      transformed.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity

      return transformed
    })

    toServerCaseKeysTasks.forEach((task) => {
      finalEntitiesMap.set(task.id.toString(), task)
    })

    if (reorderedTasks.length > 0) {
      reorderedTasks.forEach((reorderedTask) => {
        finalEntitiesMap.set(reorderedTask._id.toString(), toServerCaseKeys<ITask>(reorderedTask))
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log[0].id,
    }
  }

  public async createMany(
    data: TaskDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITaskWithTempClientId[]>> {
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
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    timezone: string
  ): Promise<IResponseWithLog<ITask[]>> {
    let reorderedTasks: ITaskRaw[] = []

    const filter = this.repository.buildFilter(criteria, userId)

    const finalEntitiesMap = new Map<string, ITaskRaw>()
    const tasksToUpdate: ITaskRaw[] = await this.repository.find(filter, session)

    if (tasksToUpdate.length === 0) throw new NotFoundError('Задачи для обновления не найдены.')

    const taskPayload = await this.prepareTaskEditPayload(data, tasksToUpdate, timezone)
    const tasksBefore = projectProperties<ITaskRaw>(tasksToUpdate, taskPayload)

    /* UPDATE */
    const newEntities = await this.repository.updateByFilter(filter, taskPayload, session)

    const newEntity = newEntities[0]

    if (!newEntity) return { data: [], logId: null }

    /* MOVE */
    const tasksToMove = tasksToUpdate.filter(
      (t) => data.categoryId !== undefined && t.category_id.toString() !== data.categoryId
    )

    if (tasksToMove.length > 0) {
      await this.moveTasksToCategory(
        tasksToMove.map((t) => t._id),
        {
          boardId: newEntity.board_id,
          boardName: newEntity.board_name,
          workspaceId: newEntity.workspace_id,
          workspaceName: newEntity.workspace_name,
        },
        userId,
        session
      )
    }

    /* REORDER */
    const tasksToReorder = tasksToUpdate.filter(
      (t) => data.order !== undefined && (t.order !== data.order || tasksToMove.includes(t))
    )

    if (tasksToReorder.length > 0) {
      reorderedTasks = await this.reorderService.reorder(
        'category_id',
        newEntities,
        userId,
        session
      )
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksBefore,
        entitiesAfter: newEntities,
        dependencies: [],
      },
      userId,
      session
    )

    newEntities.forEach((task) => {
      finalEntitiesMap.set(task._id.toString(), task)
    })

    if (reorderedTasks.length > 0) {
      reorderedTasks.forEach((reorderedTask) => {
        finalEntitiesMap.set(reorderedTask._id.toString(), reorderedTask)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((ut) => toServerCaseKeys<ITask>(ut)),
      logId: log[0].id,
    }
  }

  public async edit(
    data: TaskEditDTO,
    criteria: TaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITask[]>> {
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
  ): Promise<IResponseWithLog<ITask[]>> {
    let taskIdsToReorder: string[] = []
    let reorderedTasks: ITaskRaw[] = []
    let tasksPayloadToMove: SingleUpdateDTO<Partial<ITaskRaw>>[] = []

    const finalEntitiesMap = new Map<string, ITaskRaw>()
    const tasksToUpdate: SingleUpdateDTO<Partial<ITaskRaw>>[] = []
    const tasksBefore: Partial<ITaskRaw>[] = []

    const taskIds = data.map((d) => d.id)

    const filter = this.repository.buildFilter({ ids: taskIds }, userId)

    const existingTasks: ITaskRaw[] = await this.repository.find(filter, session)

    if (existingTasks.length === 0) throw new NotFoundError('Задачи для обновления не найдены.')

    for (const dto of data) {
      const task = existingTasks.find((t) => t._id.toString() === dto.id)

      if (!task) continue

      const taskPayload = await this.prepareTaskEditPayload(dto, [task], timezone)
      tasksBefore.push(projectProperties<ITaskRaw>([task], taskPayload)[0])

      tasksToUpdate.push(taskPayload)

      if (dto.categoryId && task.category_id.toString() !== dto.categoryId) {
        tasksPayloadToMove.push(taskPayload)
      }

      if (dto.order != null && task.order !== dto.order) {
        taskIdsToReorder.push(dto.id)
      }
    }

    /* BULK UPDATE */
    const updatedTasks = await this.repository.bulkUpdate(tasksToUpdate, userId, session)

    /* MOVE */
    if (tasksPayloadToMove.length > 0) {
      await this.moveTasksToCategoryBulk(
        tasksPayloadToMove as (SingleUpdateDTO<Partial<ITaskRaw>> & {
          category_id: Types.ObjectId
        })[],
        userId,
        session
      )
    }

    /* REORDER */
    if (taskIdsToReorder.length > 0) {
      const updatedTasksToReorder = updatedTasks.filter((ut) =>
        taskIdsToReorder.includes(ut._id.toString())
      )

      if (updatedTasksToReorder.length > 0) {
        reorderedTasks = await this.reorderService.reorder(
          'category_id',
          updatedTasksToReorder,
          userId,
          session
        )
      }
    }

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

    updatedTasks.forEach((task) => {
      finalEntitiesMap.set(task._id.toString(), task)
    })

    if (reorderedTasks.length > 0) {
      reorderedTasks.forEach((reorderedTask) => {
        finalEntitiesMap.set(reorderedTask._id.toString(), reorderedTask)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((ut) => toServerCaseKeys<ITask>(ut)),
      logId: log[0].id,
    }
  }

  public async editMany(
    data: TaskEditDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITask[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession, user.timezone)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session, user.timezone)
      )
    }
  }

  public async moveTasksToCategoryBulk(
    data: (SingleUpdateDTO<Partial<ITaskRaw>> & { category_id: Types.ObjectId })[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITaskRaw[]> {
    const newCategoriesIds = data.map((d) => d.category_id.toString() || '')
    const rawUpdates: SingleUpdateDTO<Partial<ITaskRaw>>[] = []

    const categories = await this.categoryService.getAll(
      {
        ids: newCategoriesIds,
      },
      userId,
      session
    )

    for (const dto of data) {
      const category = categories.find((c) => c.id.toString() === dto.category_id.toString())
      if (!category) throw new NotFoundError('Категория для перемещения не найдена.')

      rawUpdates.push({
        _id: dto._id,
        board_id: category.boardId,
        board_name: category.boardName,
        workspace_id: category.workspaceId,
        workspace_name: category.workspaceName,
      })
    }

    return await this.repository.bulkUpdate(rawUpdates, userId, session)
  }

  public async moveTasksToCategory(
    taskIds: Types.ObjectId[],
    targets: {
      boardId: Types.ObjectId
      boardName: string
      workspaceId: Types.ObjectId
      workspaceName: string
    },
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITaskRaw[]> {
    if (!targets) throw new NotFoundError('Категория для перемещения не найдена.')

    const filter = this.repository.buildFilter({ ids: taskIds.map((id) => id.toString()) }, userId)

    return await this.repository.updateByFilter(
      filter,
      {
        board_id: targets.boardId,
        board_name: targets.boardName,
        workspace_id: targets.workspaceId,
        workspace_name: targets.workspaceName,
      },
      session
    )
  }

  public async moveTasksToBoardByCategoriesBulk(
    categoriesMap: Map<
      string,
      {
        boardId: Types.ObjectId
        boardName: string
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    >,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filter = this.repository.buildFilter(
      { categoryIds: Array.from(categoriesMap.keys()).map((id) => id.toString()) },
      userId
    )

    const tasksToUpdate = await this.repository.find(filter, session)

    const updates: SingleUpdateDTO<Partial<ITaskRaw>>[] = []

    for (const task of tasksToUpdate) {
      const newEntity = categoriesMap.get(task.category_id.toString())
      if (newEntity) {
        updates.push({
          _id: task._id,
          board_id: newEntity.boardId,
          board_name: newEntity.boardName,
          workspace_id: newEntity.workspaceId,
          workspace_name: newEntity.workspaceName,
        })
      }
    }
    const updatedTasks = await this.repository.bulkUpdate(updates, userId, session)

    return updatedTasks.map((t) => toServerCaseKeys<ITask>(t))
  }

  public async moveTasksToBoardByCategories(
    categoryIds: Types.ObjectId[],
    targets: {
      boardId: Types.ObjectId
      boardName: string
      workspaceId: Types.ObjectId
      workspaceName: string
    },
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filter = this.repository.buildFilter(
      { categoryIds: categoryIds.map((id) => id.toString()) },
      userId
    )

    await this.repository.find(filter, session)

    const updatedTasks = await this.repository.updateByFilter(
      filter,
      {
        board_id: targets.boardId,
        board_name: targets.boardName,
        workspace_id: targets.workspaceId,
        workspace_name: targets.workspaceName,
      },
      session
    )

    return updatedTasks.map((t) => toServerCaseKeys<ITask>(t))
  }

  public async moveTasksToWorkspaceByBoardsBulk(
    boardsMap: Map<
      string,
      {
        id: Types.ObjectId
        name: string
      }
    >,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filter = this.repository.buildFilter(
      { boardIds: Array.from(boardsMap.keys()).map((id) => id.toString()) },
      userId
    )

    const tasksToUpdate = await this.repository.find(filter, session)

    const updates: SingleUpdateDTO<Partial<ITaskRaw>>[] = []

    for (const task of tasksToUpdate) {
      const newWorkspace = boardsMap.get(task.board_id.toString())
      if (newWorkspace) {
        updates.push({
          _id: task._id,
          workspace_id: new Types.ObjectId(newWorkspace.id),
          workspace_name: newWorkspace.name,
        })
      }
    }
    const updatedTasks = await this.repository.bulkUpdate(updates, userId, session)

    return updatedTasks.map((t) => toServerCaseKeys<ITask>(t))
  }

  public async moveTasksToWorkspaceByBoards(
    boardIds: Types.ObjectId[],
    targetWorkspace: {
      id: Types.ObjectId
      name: string
    },
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )

    await this.repository.find(filter, session)

    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { workspace_id: targetWorkspace.id, workspace_name: targetWorkspace.name },
      session
    )

    return updatedTasks.map((t) => toServerCaseKeys<ITask>(t))
  }

  private async _executeDeleteTransaction(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<ITask[]> {
    let reorderedTasks: ITaskRaw[] = []

    const filter = this.repository.buildFilter(criteria, userId)

    const tasksToDelete = await this.repository.find(filter, session)

    if (tasksToDelete.length === 0) throw new NotFoundError('Задачи для удаления не найдены.')

    await this.repository.deleteMany(filter, session)

    /* REORDER */
    reorderedTasks = await this.reorderService.reorderByParentIds(
      tasksToDelete.map((t) => t.category_id),
      userId,
      session
    )

    await session.commitTransaction()

    return [...reorderedTasks.map((rt) => toServerCaseKeys<ITask>(rt))]
  }

  public async delete(
    criteria: TaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<ITask[]> {
    const userId = user.id

    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeArchiveTransaction(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ITasksResponse>> {
    let reorderedTasks: ITaskRaw[] = []

    const finalEntitiesMap = new Map<string, ITaskRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const tasksToArchive = await this.repository.find(filter, session)

    if (tasksToArchive.length === 0) throw new NotFoundError('Задачи для архивации не найдены.')

    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, deleted_time: new Date() },
      session
    )

    /* REORDER */
    reorderedTasks = await this.reorderService.reorderByParentIds(
      tasksToArchive.map((t) => t.category_id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: updatedTasks.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    updatedTasks.forEach((task) => {
      finalEntitiesMap.set(task._id.toString(), task)
    })

    reorderedTasks.forEach((task) => {
      finalEntitiesMap.set(task._id.toString(), task)
    })

    const finalObj = {
      tasks: Array.from(finalEntitiesMap.values()).map((ut) => toServerCaseKeys<ITask>(ut)),
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async archive(
    criteria: TaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITasksResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeArchiveTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeArchiveTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeRecoverTransaction(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ITasksResponse>> {
    let reorderedTasks: ITaskRaw[] = []

    const finalEntitiesMap = new Map<string, ITaskRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const tasksToRecover = await this.repository.find(filter, session)

    if (tasksToRecover.length === 0)
      throw new NotFoundError('Задачи для восстановления не найдены.')

    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, deleted_time: undefined },
      session
    )

    /* REORDER */
    reorderedTasks = await this.reorderService.reorderByParentIds(
      tasksToRecover.map((t) => t.category_id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.RECOVER,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: updatedTasks.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    updatedTasks.forEach((task) => {
      finalEntitiesMap.set(task._id.toString(), task)
    })

    reorderedTasks.forEach((task) => {
      finalEntitiesMap.set(task._id.toString(), task)
    })

    const finalObj = {
      tasks: Array.from(finalEntitiesMap.values()).map((ut) => toServerCaseKeys<ITask>(ut)),
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async recover(
    criteria: TaskCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ITasksResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeRecoverTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeRecoverTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ITask[]>> {
    const filter = this.repository.buildFilter(criteria, userId)

    const tasksToClone = await this.repository.find(
      filter,
      session,
      '+embeddings -createdAt -updatedAt'
    )

    if (tasksToClone.length === 0) throw new NotFoundError('Задачи для клонирования не найдены.')

    const tasksGrouppedByCategory: Map<string, ITaskRaw[]> = new Map()
    tasksToClone.forEach((task) => {
      const categoryId = task.category_id.toString()
      if (!tasksGrouppedByCategory.has(categoryId)) {
        tasksGrouppedByCategory.set(categoryId, [])
      }

      tasksGrouppedByCategory.get(categoryId)!.push(task)
    })

    const transformedTasks: Omit<ITaskRaw, '_id'>[] = []

    const categoryIds = Array.from(tasksGrouppedByCategory.keys())

    const filterByCategories = this.repository.buildFilter({ categoryIds }, userId)

    const existingTasksLite = await this.repository.find(
      filterByCategories,
      session,
      'category_id order'
    )

    for (const [categoryId, tasks] of tasksGrouppedByCategory) {
      const categoryTasks = existingTasksLite.filter((t) => t.category_id.toString() === categoryId)

      let currentMaxOrder = categoryTasks.reduce((max, t) => (t.order > max ? t.order : max), 0)

      for (const task of tasks) {
        const cleanTask = {
          ...task,
          _id: undefined,
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
      data: [...newTasks.map((nt) => toServerCaseKeys<ITask>(nt))],
      logId: log[0].id,
    }
  }

  public async clone(
    criteria: TaskCriteria,
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
  ): Promise<IResponseWithLog<IUndoResponse<ITasksResponse>>> {
    const entitiesBefore = log.entitiesBefore as (Partial<ITask> & { id: Types.ObjectId })[]
    const entitiesAfter = log.entitiesAfter as ITask[]

    const taskBeforeIds = entitiesBefore.map((e) => e.id.toString())
    const taskAfterIds = entitiesAfter.map((e) => e.id.toString())
    const operationType = log.operationType

    if (operationType === OperationTypesEnum.CREATE) {
      await this.delete({ ids: taskAfterIds }, user, session)

      return {
        data: { delete: { tasks: entitiesAfter } },
        logId: null,
      }
    } else if (operationType === OperationTypesEnum.UPDATE) {
      const entitiesBeforeToEditSchema = entitiesBefore.map((e) => {
        return {
          ...toServerCaseKeys<ITask>(e),
          id: e.id.toString(),
          categoryId: e.categoryId?.toString(),
          boardId: e.boardId?.toString(),
          workspaceId: e.workspaceId?.toString(),
        }
      })

      const editResult = await this.editMany(entitiesBeforeToEditSchema, user, session)

      return {
        data: { update: { tasks: editResult.data } },
        logId: editResult.logId,
      }
    } else if (operationType === OperationTypesEnum.ARCHIVE) {
      const recoverResult = await this.recover({ ids: taskBeforeIds }, user, session)

      return {
        data: { update: { tasks: recoverResult.data.tasks } },
        logId: recoverResult.logId,
      }
    } else if (operationType === OperationTypesEnum.RECOVER) {
      const archiveResult = await this.archive({ ids: taskBeforeIds }, user, session)

      return {
        data: { update: archiveResult.data },
        logId: archiveResult.logId,
      }
    } else throw new Error(`Операция ${operationType} не поддерживается для отката.`)
  }

  public async cloneTasksByCategories(
    categoryIdsMap: Map<string, string>,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<ITask[]> {
    const categoryIds = Array.from(categoryIdsMap.keys())
    const filter = this.repository.buildFilter({ categoryIds }, userId)
    const sourceTasks = await this.repository.find(filter, session)

    const cleanTasks = sourceTasks.map((task) => ({
      ...task,
      category_id: new Types.ObjectId(categoryIdsMap.get(task.category_id.toString())),
      _id: undefined,
    }))

    const clonedTasks = await this.repository.createMany(cleanTasks, session)

    const clonedTasksTransformed = clonedTasks.map((cb) => toServerCaseKeys<ITask>(cb))

    return clonedTasksTransformed
  }

  public async deleteTasksByCategories(
    categoryIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const filter = this.repository.buildFilter(
      { categoryIds: categoryIds.map((id) => id.toString()) },
      userId
    )

    await this.repository.deleteMany(filter, session)
  }

  public async archiveTasksByCategories(
    categoryIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filter = this.repository.buildFilter(
      { categoryIds: categoryIds.map((id) => id.toString()), isDeleted: false },
      userId
    )
    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, is_deleted_external: true },
      session
    )

    return updatedTasks.map((c) => toServerCaseKeys<ITask>(c))
  }

  public async recoverTasksByCategories(
    categoryIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filter = this.repository.buildFilter(
      { categoryIds: categoryIds.map((id) => id.toString()) },
      userId
    )
    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, is_deleted_external: false },
      session
    )

    return updatedTasks.map((c) => toServerCaseKeys<ITask>(c))
  }

  private async prepareTaskCreationPayload(
    data: TaskDTO,
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession
  ) {
    const taskName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(taskName)

    const taskPayload: ITaskRaw = {
      ...toMongoCaseKeys(data),
      _id: new Types.ObjectId(),
      embeddings,
      user_id: userId,
    }

    this.prepareTaskMainFields(data, taskPayload, timezone)

    if (data.order === undefined) {
      const lastOrder = await this.getLastOrder(data.categoryId, userId, session)

      taskPayload.order = lastOrder + 1
    }

    return taskPayload
  }

  private async prepareTasksCreationPayload(
    data: TaskDTO[],
    userId: Types.ObjectId,
    timezone: string,
    session?: ClientSession
  ) {
    const tasksPayloads: Omit<ITaskRaw, '_id'>[] = []
    const tasksGroupedByCategory: { [key: string]: TaskDTO[] } = {}

    data.forEach((task) => {
      const categoryId = task.categoryId
      if (!tasksGroupedByCategory[categoryId]) {
        tasksGroupedByCategory[categoryId] = []
      }

      tasksGroupedByCategory[categoryId].push(task)
    })

    const grouppedTasksCount = await this.getLastOrderGrouppedByCategory(
      Object.keys(tasksGroupedByCategory),
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
        (entry) => entry.category_id.toString() === categoryId
      )
      let newOrder = existingCountEntry ? existingCountEntry.lastOrder : 0

      tasks.forEach((task) => {
        if (task.order === undefined) {
          task.order = ++newOrder
        }
      })

      for (const task of tasks) {
        const taskName = task.name.trim()
        const taskPayload: Omit<ITaskRaw, '_id'> = {
          ...toMongoCaseKeys(task),
          embeddings: embeddingsMap[taskName],
          user_id: userId,
        }

        this.prepareTaskMainFields(task, taskPayload, timezone)

        tasksPayloads.push(taskPayload)
      }
    }

    return tasksPayloads
  }

  private prepareTaskMainFields(
    data: TaskDTO | TaskEditDTO,
    taskPayload: Partial<ITaskRaw>,
    timezone: string
  ) {
    if (data.color && TASK_COLORS_MAP[data.color]) {
      taskPayload.color_name = TASK_COLORS_MAP[data.color]
    }

    if (data.dueDate && data.dueHours != null && data.dueMinutes != null && timezone) {
      const collectedDateTime = `${data.dueDate}T${data.dueHours}:${data.dueMinutes}`
      const utcDueDate = dayjs.tz(collectedDateTime, timezone).utc()

      taskPayload.due_date = utcDueDate.format('YYYY-MM-DD')
      taskPayload.due_hours = utcDueDate.hour()
      taskPayload.due_minutes = utcDueDate.minute()
    }
  }

  private async prepareTaskEditPayload(
    data: TaskEditDTO,
    tasksToUpdate: ITaskRaw[],
    timezone: string
  ) {
    const taskPayload: SingleUpdateDTO<Partial<ITaskRaw>> = {
      ...toMongoCaseKeys(data),
    }

    if (data.tags) taskPayload.tags = data.tags.map((tag) => tag.toString())

    if (typeof data.order === 'number') {
      taskPayload.order = data.order
    } else if (typeof data.order === 'string') {
      taskPayload.order = parseInt(data.order, 10)
    }

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

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask | null> {
    const task = await this.repository.findByIdAndUser(id, userId, session)

    return toServerCaseKeys(task)
  }

  public async getCount(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter(criteria, userId)

    return await this.repository.getCount(filter, session)
  }

  public async getLastOrder(
    categoryId: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter({ categoryId }, userId)

    const existingTasksLite = await this.repository.find(filter, session, 'category_id order')

    let currentMaxOrder = existingTasksLite.reduce((max, t) => (t.order > max ? t.order : max), 0)

    return currentMaxOrder
  }

  public async getLastOrderGrouppedByCategory(
    categoryIds: string[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ category_id: Types.ObjectId; lastOrder: number }[]> {
    const counts = []

    const uniqueCategoryIds = Array.from(new Set(categoryIds))

    const filterByCategories = this.repository.buildFilter(
      { categoryIds: uniqueCategoryIds },
      userId
    )

    const existingTasksLite = await this.repository.find(
      filterByCategories,
      session,
      'category_id order'
    )

    for (const categoryId of uniqueCategoryIds) {
      const categoryTasks = existingTasksLite.filter((t) => t.category_id.toString() === categoryId)

      let currentMaxOrder = categoryTasks.reduce((max, t) => (t.order > max ? t.order : max), 0)

      counts.push({ category_id: new Types.ObjectId(categoryId), lastOrder: currentMaxOrder })
    }

    return counts
  }

  public getNearestColor(hexColor: string) {
    let closestColor: (typeof TASK_COLORS)[number] | null = null
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

  public async getAll(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const tasks = await this.repository.find(filter, session)

    return tasks.map((ws) => toServerCaseKeys(ws))
  }

  public async getByFilter(
    filter: FilterQuery<ITaskRaw>,
    userId: Types.ObjectId,
    limit: number,
    session?: ClientSession
  ): Promise<ITask[]> {
    const filterWithUser = { ...filter, user_id: userId }
    const tasks = await this.repository.find(filterWithUser, session, null, limit)

    return tasks.map((ws) => toServerCaseKeys(ws))
  }
}
