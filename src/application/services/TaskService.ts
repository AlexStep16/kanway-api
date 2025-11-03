import { ITask } from '@entities/ITask.ts'
import { ITaskRaw } from '@entities/ITaskRaw.ts'
import TaskRepository from '@repositories/TaskRepository.ts'
import { TaskDTO } from '@application/dtos/TaskDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { TaskCriteria } from '@criterias/TaskCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import { ReorderResultDTO } from '../dtos/ReorderResultDTO.ts'
import { IOperationResult } from '../interfaces/IOperationResult.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { TASK_COLORS_MAP } from '@/constants/TASK_COLORS.ts'
import dayjs from 'dayjs'
import { IMoveResult } from '../interfaces/IMoveResult.ts'
import { CategoryService } from './CategoryService.ts'

export class TaskService implements IBaseService<ITask, TaskCriteria, TaskDTO, TaskEditDTO> {
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

  public async create(
    data: TaskDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ITask[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedTasks: ReorderResultDTO<ITaskRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const taskPayload = await this.prepareTaskCreationPayload(data, userId)

      /* CREATE */
      const newTask = await this.repository.create(taskPayload, session)

      /* REORDER */
      if (data.order !== undefined) {
        reorderedTasks = await this.reorderService.reorder(
          'category_id',
          [newTask],
          CollectionsEnum.TASKS,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedTasks.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesAfter: [newTask],
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedTasks.length > 0) {
        const reorderedEntities = reorderedTasks.map((r) => r.updatedEntities).flat()
        return [
          toServerCaseKeys(newTask),
          ...reorderedEntities.map((re) => toServerCaseKeys<ITask>(re)),
        ]
      }

      return [toServerCaseKeys(newTask)]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async createMany(
    data: TaskDTO[],
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ITask[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedTasks: ReorderResultDTO<ITaskRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const tasksPayload = await this.prepareTasksCreationPayload(data, userId, session)

      /* CREATE */
      const newTasks = await this.repository.createMany(tasksPayload, session)

      /* REORDER */
      const isReorderNeeded = data.some((ws) => ws.order !== undefined)
      if (isReorderNeeded) {
        reorderedTasks = await this.reorderService.reorder(
          'category_id',
          newTasks,
          CollectionsEnum.TASKS,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedTasks.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesAfter: newTasks,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedTasks.length > 0) {
        const reorderedEntities = reorderedTasks.map((r) => r.updatedEntities).flat()
        return [
          ...newTasks.map((nb) => toServerCaseKeys<ITask>(nb)),
          ...reorderedEntities.map((re) => toServerCaseKeys<ITask>(re)),
        ]
      }

      return [...newTasks.map((nb) => toServerCaseKeys<ITask>(nb))]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async edit(
    data: TaskEditDTO,
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ITask[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedTasks: ReorderResultDTO<ITaskRaw>[] = []
    let dependencies: Types.ObjectId[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const tasksToUpdate: ITaskRaw[] = await this.repository.find(filter, session)

      const taskPayload = await this.prepareTaskEditPayload(data, tasksToUpdate, userId)

      /* UPDATE */
      const newEntities = await this.repository.updateByFilter(filter, taskPayload, session)

      /* MOVE */
      const taskToMove = tasksToUpdate.filter(
        (t) => data.categoryId !== undefined && t.category_id.toString() !== data.categoryId
      )
      if (taskToMove.length > 0) {
        const moveResult = await this.moveTasksToCategory(
          taskToMove.map((t) => t._id),
          new Types.ObjectId(data.categoryId),
          userId,
          newEntities,
          session
        )

        dependencies.push(...moveResult.logIds)
      }

      /* REORDER */
      const tasksToReorder = tasksToUpdate.filter(
        (ws) => data.order !== undefined && ws.order !== data.order
      )
      if (tasksToReorder.length > 0) {
        reorderedTasks = await this.reorderService.reorder(
          'category_id',
          tasksToReorder,
          CollectionsEnum.TASKS,
          userId,
          session
        )
      }

      /* LOG */
      reorderedTasks.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesBefore: tasksToUpdate,
          entitiesAfter: newEntities,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedTasks.length > 0) {
        const reorderedEntities = reorderedTasks.map((r) => r.updatedEntities).flat()
        return [
          ...newEntities.map((ne) => toServerCaseKeys<ITask>(ne)),
          ...reorderedEntities.map((re) => toServerCaseKeys<ITask>(re)),
        ]
      }

      return [...newEntities.map((ne) => toServerCaseKeys<ITask>(ne))]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async moveTasksToCategory(
    taskIds: Types.ObjectId[],
    targetCategoryId: Types.ObjectId,
    userId: Types.ObjectId,
    updatedTasksBefore: ITaskRaw[],
    session?: ClientSession
  ): Promise<IMoveResult> {
    const newCategory = await this.categoryService.getById(
      targetCategoryId.toString(),
      userId,
      session
    )

    if (!newCategory) throw new NotFoundError('Категория для перемещения не найдена.')

    const filter = this.repository.buildFilter({ ids: taskIds.map((id) => id.toString()) }, userId)

    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { board_id: newCategory.boardId, workspace_id: newCategory.workspaceId },
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: updatedTasksBefore,
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      logIds: [log[0].id],
    }
  }

  public async moveTasksToBoardByCategories(
    categoryIds: Types.ObjectId[],
    targetBoardId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<ITask>> {
    const filter = this.repository.buildFilter(
      { categoryIds: categoryIds.map((id) => id.toString()) },
      userId
    )

    const tasksToUpdate = await this.repository.find(filter, session)

    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { board_id: targetBoardId },
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksToUpdate,
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      entities: updatedTasks.map((t) => toServerCaseKeys<ITask>(t)),
      logIds: [log[0].id],
    }
  }

  public async moveTasksToWorkspaceByBoards(
    boardIds: Types.ObjectId[],
    targetWorkspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<ITask>> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )

    const tasksToUpdate = await this.repository.find(filter, session)

    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { workspace_id: targetWorkspaceId },
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: tasksToUpdate,
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      entities: updatedTasks.map((t) => toServerCaseKeys<ITask>(t)),
      logIds: [log[0].id],
    }
  }

  public async delete(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ITask[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedTasks: ReorderResultDTO<ITaskRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const tasksToDelete = await this.repository.find(filter, session)

      await this.repository.deleteMany(filter, session)

      /* REORDER */
      reorderedTasks = await this.reorderService.reorderByParentIds(
        tasksToDelete.map((t) => t.category_id),
        CollectionsEnum.TASKS,
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedTasks.map((r) => r.updatedEntities).flat()

      return [...reorderedEntities.map((re) => toServerCaseKeys<ITask>(re))]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async archive(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ITask[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedTasks: ReorderResultDTO<ITaskRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const tasksToArchive = await this.repository.find(filter, session)

      const updatedTasks = await this.repository.updateByFilter(
        filter,
        { is_deleted: true },
        session
      )

      /* REORDER */
      reorderedTasks = await this.reorderService.reorderByParentIds(
        tasksToArchive.map((t) => t.category_id),
        CollectionsEnum.TASKS,
        userId,
        session
      )

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesBefore: updatedTasks.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedTasks,
          dependencies: [],
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedTasks.map((r) => r.updatedEntities).flat()

      return [
        ...updatedTasks.map((ub) => toServerCaseKeys<ITask>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<ITask>(re)),
      ]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async recover(
    criteria: TaskCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ITask[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedTasks: ReorderResultDTO<ITaskRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const tasksToRecover = await this.repository.find(filter, session)

      const updatedTasks = await this.repository.updateByFilter(
        filter,
        { is_deleted: false },
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      /* REORDER */
      reorderedTasks = await this.reorderService.reorderByParentIds(
        tasksToRecover.map((t) => t.category_id),
        CollectionsEnum.TASKS,
        userId,
        session
      )

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesBefore: updatedTasks.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedTasks,
          dependencies: [],
        },
        userId,
        session
      )

      const reorderedEntities = reorderedTasks.map((r) => r.updatedEntities).flat()

      return [
        ...updatedTasks.map((ub) => toServerCaseKeys<ITask>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<ITask>(re)),
      ]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async clone(id: string, userId: Types.ObjectId): Promise<ITask> {
    let session: ClientSession | null = null

    try {
      session = await mongoose.startSession()
      session.startTransaction()

      const sourceTask = await this.repository.findByIdAndUser(id, userId, session)

      if (!sourceTask) throw new NotFoundError('Исходная задача не найдена.')

      const allTasks = await this.repository.find({ category_id: sourceTask.category_id }, session)

      const cleanTask = {
        ...sourceTask,
        _id: undefined,
        order: allTasks.length + 1,
        name: `${sourceTask?.name} - Копия`,
      }

      const newTask = await this.repository.create(cleanTask, session)

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.TASKS,
          entitiesAfter: [newTask],
          dependencies: [],
        },
        userId,
        session
      )

      await session.commitTransaction()

      return toServerCaseKeys<ITask>(newTask)
    } catch (error) {
      if (session) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session) {
        session.endSession()
      }
    }
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
  ): Promise<IOperationResult<ITask>> {
    const filter = this.repository.buildFilter(
      { categoryIds: categoryIds.map((id) => id.toString()) },
      userId
    )
    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, is_deleted_external: true },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: updatedTasks.map((c) => ({ ...c, is_deleted: false })),
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      entities: updatedTasks.map((c) => toServerCaseKeys<ITask>(c)),
      logIds: log.map((l) => l.id),
    }
  }

  public async recoverTasksByCategories(
    categoryIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<ITask>> {
    const filter = this.repository.buildFilter(
      { categoryIds: categoryIds.map((id) => id.toString()) },
      userId
    )
    const updatedTasks = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, is_deleted_external: false },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesBefore: updatedTasks.map((c) => ({ ...c, is_deleted: true })),
        entitiesAfter: updatedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      entities: updatedTasks.map((c) => toServerCaseKeys<ITask>(c)),
      logIds: log.map((l) => l.id),
    }
  }

  public async cloneTasksByCategory(
    sourceCategoryId: Types.ObjectId,
    targetCategoryId: Types.ObjectId,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IOperationResult<ITask>> {
    const filter = this.repository.buildFilter({ categoryId: sourceCategoryId.toString() }, userId)
    const sourceTasks = await this.repository.find(filter, session)

    const cleanTasks = sourceTasks.map((task) => ({
      ...task,
      category_id: targetCategoryId,
      _id: undefined,
    }))

    const clonedTasks = await this.repository.createMany(cleanTasks, session)

    /* LOG */
    const logs = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: clonedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    const clonedTasksTransformed = clonedTasks.map((cb) => toServerCaseKeys<ITask>(cb))

    return {
      entities: clonedTasksTransformed,
      logIds: logs.map((log) => log.id),
    }
  }

  public async cloneTasksByCategories(
    categoryIdsMap: Map<string, string>,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IOperationResult<ITask>> {
    const categoryIds = Array.from(categoryIdsMap.values())
    const filter = this.repository.buildFilter({ categoryIds }, userId)
    const sourceTasks = await this.repository.find(filter, session)

    const cleanTasks = sourceTasks.map((task) => ({
      ...task,
      category_id: new Types.ObjectId(categoryIdsMap.get(task.category_id.toString())),
      _id: undefined,
    }))

    const clonedTasks = await this.repository.createMany(cleanTasks, session)

    /* LOG */
    const logs = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.TASKS,
        entitiesAfter: clonedTasks,
        dependencies: [],
      },
      userId,
      session
    )

    const clonedTasksTransformed = clonedTasks.map((cb) => toServerCaseKeys<ITask>(cb))

    return {
      entities: clonedTasksTransformed,
      logIds: logs.map((log) => log.id),
    }
  }

  private async prepareTaskCreationPayload(
    data: TaskDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const taskName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(taskName)

    const taskPayload: Omit<ITaskRaw, '_id'> = {
      ...toMongoCaseKeys(data),
      embeddings,
      user_id: userId,
    }

    this.prepareTaskMainFields(data, taskPayload)

    if (data.order === undefined) {
      const allTasksCount = await this.getCount({ categoryId: data.categoryId }, userId, session)
      taskPayload.order = allTasksCount + 1
    }

    return taskPayload
  }

  private async prepareTasksCreationPayload(
    data: TaskDTO[],
    userId: Types.ObjectId,
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

    const grouppedTasksCount = await this.getCountGrouppedByCategory(
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
      let newOrder = existingCountEntry ? existingCountEntry.count : 0

      tasks.forEach((task) => {
        if (task.order === undefined) {
          newOrder++
          task.order = newOrder
        }
      })

      for (const task of tasks) {
        const taskName = task.name.trim()
        const taskPayload: Omit<ITaskRaw, '_id'> = {
          ...toMongoCaseKeys(task),
          embeddings: embeddingsMap[taskName],
          user_id: userId,
        }

        this.prepareTaskMainFields(task, taskPayload)

        tasksPayloads.push(taskPayload)
      }
    }

    return tasksPayloads
  }

  private prepareTaskMainFields(data: TaskDTO | TaskEditDTO, taskPayload: Partial<ITaskRaw>) {
    if (data.color && TASK_COLORS_MAP[data.color]) {
      taskPayload.color_name = TASK_COLORS_MAP[data.color]
    }

    if (data.dueDate) {
      const utcDueDate = dayjs.tz(data.dueDate, data.timezone)

      taskPayload.due_date = utcDueDate.toDate()
      taskPayload.due_hours = utcDueDate.hour()
      taskPayload.due_minutes = utcDueDate.minute()
    }
  }

  private async prepareTaskEditPayload(
    data: TaskEditDTO,
    tasksToUpdate: ITaskRaw[],
    userId: Types.ObjectId
  ) {
    const taskPayload: Partial<ITaskRaw> = {
      ...toMongoCaseKeys(data),
      user_id: userId,
    }

    this.prepareTaskMainFields(data, taskPayload)

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

    return this.repository.getCount(filter, session)
  }

  public async getCountGrouppedByCategory(
    categoryIds: string[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ category_id: Types.ObjectId; count: number }[]> {
    return this.repository.getCountGrouppedByCategories(
      categoryIds.map((id) => new Types.ObjectId(id)),
      userId,
      session
    )
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
}
