import { ICategoryRaw } from '@entities/ICategoryRaw.ts'
import CategoryRepository from '@repositories/CategoryRepository.ts'
import { CategoryDTO } from '@application/dtos/CategoryDTO.ts'
import mongoose, {
  ClientSession,
  DeleteResult,
  MongooseBulkWriteResult,
  Types,
  UpdateWriteOpResult,
} from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { ICategoryCriteria } from '@criterias/ICategoryCriteria.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { BoardService } from '@application/services/BoardService.ts'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.ts'
import { ICategory } from '@entities/ICategory.ts'
import { IUser } from '@entities/IUser.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@entities/IOperationLog.ts'
import { IUndoResponse } from '@application/interfaces/IUndoResponse.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { LifecycleDTO } from '@dtos/LifecycleDTO.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { BaseService } from '@application/services/BaseService.ts'
import { ICategoryPopulated } from '@interfaces/ICategoryPopulated.ts'
import { ICategoryCreatePayload } from '@interfaces/ICategoryCreatePayload.ts'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.ts'

const MAX_RETRIES = 3

type ReorderServiceType = ReorderService<
  ICategory,
  ICategoryRaw,
  ICategoryCriteria,
  ICategoryPopulated,
  ICategoryCreatePayload
>

export class CategoryService extends BaseService<
  ICategoryRaw,
  ICategory,
  ICategoryCriteria,
  ICategoryPopulated,
  ICategoryCreatePayload
> {
  protected repository: CategoryRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderServiceType
  protected workspaceService: WorkspaceService
  protected boardService: BoardService
  protected taskService: TaskService

  constructor(
    categoryRepository: CategoryRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderServiceType,
    workspaceService: WorkspaceService,
    boardService: BoardService,
    taskService: TaskService,
  ) {
    super(categoryRepository)

    this.repository = categoryRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.workspaceService = workspaceService
    this.boardService = boardService
    this.taskService = taskService
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
    data: CategoryDTO,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const categoryPayload = await this.prepareCategoryCreationPayload(data, userId, session)

    const sideEffects: Promise<any>[] = []

    /* CREATE */
    const newCategory = await this.repository.create(categoryPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      sideEffects.push(this.reorderService.reorder('board', [newCategory], userId, session))
    }

    sideEffects.push(
      this.boardService.updateCategoriesCount(
        [new Types.ObjectId(newCategory.board.id)],
        userId,
        session,
      ),
      this.workspaceService.updateCategoriesCount(
        [new Types.ObjectId(newCategory.workspace.id)],
        userId,
        session,
      ),
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: [newCategory],
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const newCategoriesPopulated = await this.getByCriteria(
      { id: newCategory.id.toString() },
      userId,
      session,
    )

    newCategoriesPopulated[0].tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

    return {
      data: newCategoriesPopulated,
      logId: log.id,
    }
  }

  public async create(
    data: CategoryDTO,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
    data: CategoryDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoriesPayload = await this.prepareCategoriesCreationPayload(data, userId, session)

    /* CREATE */
    const newCategories = await this.repository.createMany(categoriesPayload, session)

    const sideEffects: Promise<any>[] = []

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      sideEffects.push(this.reorderService.reorder('board', newCategories, userId, session))
    }

    const newCategoriesPopulated = await this.getByCriteria(
      { ids: newCategories.map((t) => t.id.toString()) },
      userId,
      session,
    )

    newCategoriesPopulated.forEach((nc, index) => {
      nc.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity
    })

    const uniqueBoardIds = [
      ...new Set(newCategories.map((category) => category.board.toHexString())),
    ]
    const uniqueWorkspaceIds = [
      ...new Set(newCategories.map((category) => category.workspace.toHexString())),
    ]

    sideEffects.push(
      this.boardService.updateCategoriesCount(
        uniqueBoardIds.map((id) => new Types.ObjectId(id)),
        userId,
        session,
      ),
      this.workspaceService.updateCategoriesCount(
        uniqueWorkspaceIds.map((id) => new Types.ObjectId(id)),
        userId,
        session,
      ),
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: newCategories,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    return {
      data: newCategoriesPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: CategoryDTO[],
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
    data: CategoryEditDTO,
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoriesToUpdate: ICategory[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (categoriesToUpdate.length === 0)
      throw new NotFoundError('Категории для редактирования не найдены.')

    const categoryPayload = await this.prepareCategoryEditPayload(data, categoriesToUpdate)
    const categoriesBefore = projectProperties<ICategory>(categoriesToUpdate, categoryPayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      categoryPayload,
      session,
      userId,
    )

    if (updateManyResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить категории.', 500)

    const updatedCategories = await this.repository.findByCriteria<ICategory>(
      criteria,
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    /* MOVE */
    const categoriesToMove = categoriesToUpdate.filter(
      (b) => data.boardId !== undefined && b.board.toString() !== data.boardId,
    )

    if (categoriesToMove.length > 0) {
      await this.regenerateReferencesByBoards(
        categoriesToMove.map((category) => category.id.toString()),
        userId,
        session,
      )

      const affectedTasks = await this.taskService.getByCriteria(
        {
          categoryIds: categoriesToMove.map((c) => c.id.toString()),
        },
        userId,
        session,
        { projection: { _id: 1 } },
      )

      sideEffects.push(
        this.taskService.regenerateReferencesByCategories(
          affectedTasks.map((t) => t.id.toString()),
          userId,
          session,
        ),
      )

      const movedIds = categoriesToMove.map((c) => c.id.toString())
      const categoriesAfterMove = updatedCategories.filter((c) =>
        movedIds.includes(c.id.toString()),
      )

      sideEffects.push(
        ...this._updateCategoriesParentCountersWithOld(
          categoriesToMove,
          categoriesAfterMove,
          userId,
          session,
        ),
      )
    }

    /* REORDER */
    const categoriesToReorder = categoriesToUpdate.filter(
      (c) => data.order !== undefined && c.order !== data.order,
    )

    const categoriesToMoveToEnd = categoriesToUpdate.filter(
      (c) => data.order == null && categoriesToMove.includes(c),
    )

    if (categoriesToReorder.length > 0 || categoriesToMoveToEnd.length > 0) {
      sideEffects.push(
        this.reorderService.reorder(
          'board',
          [
            ...categoriesToReorder,
            ...categoriesToMoveToEnd.map((c) => ({
              ...c,
              order: c.order + 99999,
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
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedCategoriesPopulated = await this.getByCriteria(criteria, userId, session)

    return {
      data: updatedCategoriesPopulated,
      logId: log.id,
    }
  }

  public async edit(
    data: CategoryEditDTO,
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
    data: CategoryEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoryIds = data.map((d) => d.id)

    const existingCategories = await this.repository.findByCriteria(
      { ids: categoryIds },
      session,
      undefined,
      userId,
    )

    if (existingCategories.length === 0) {
      throw new NotFoundError('Категории для обновления не найдены.')
    }

    const existingMap = new Map(existingCategories.map((c) => [c.id.toString(), c]))

    const categoryPayloads: SingleUpdateDTO<SafeUpdateData<ICategory>>[] = []
    const categoriesBefore: Partial<ICategory>[] = []
    const movedCategoryIds: string[] = []
    const reorderCategoryIds = new Set<string>()
    const moveToEndIds = new Set<string>()

    for (const dto of data) {
      const category = existingMap.get(dto.id)
      if (!category) continue

      const categoryPayload = await this.prepareCategoryEditPayload(dto, [category])

      categoriesBefore.push(projectProperties<ICategory>([category], categoryPayload)[0])
      categoryPayloads.push(categoryPayload)

      const isMoving = dto.boardId !== undefined && category.board.toString() !== dto.boardId
      if (isMoving) {
        movedCategoryIds.push(dto.id)
      }

      if (dto.order !== undefined && category.order !== dto.order) {
        reorderCategoryIds.add(dto.id)
      } else if (dto.order == null && isMoving) {
        reorderCategoryIds.add(dto.id)
        moveToEndIds.add(dto.id)
      }
    }

    const updatedCategoriesResult = await this.repository.bulkUpdate(
      categoryPayloads,
      userId,
      session,
    )

    if (!updatedCategoriesResult || updatedCategoriesResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить категории.', 500)
    }

    const updatedCategories = await this.repository.findByCriteria(
      { ids: categoryPayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    /** MOVE */
    if (movedCategoryIds.length > 0) {
      await this.regenerateReferencesByBoards(movedCategoryIds, userId, session)

      const affectedTasks = await this.taskService.getByCriteria(
        { categoryIds: movedCategoryIds },
        userId,
        session,
        { projection: { _id: 1 } },
      )

      if (affectedTasks.length > 0) {
        sideEffects.push(
          this.taskService.regenerateReferencesByCategories(
            affectedTasks.map((t) => t.id.toString()),
            userId,
            session,
          ),
        )
      }

      const categoriesToMove = existingCategories.filter((c) =>
        movedCategoryIds.includes(c.id.toString()),
      )
      const categoriesAfterMove = updatedCategories.filter((c) =>
        movedCategoryIds.includes(c.id.toString()),
      )

      sideEffects.push(
        ...this._updateCategoriesParentCountersWithOld(
          categoriesToMove,
          categoriesAfterMove,
          userId,
          session,
        ),
      )
    }

    /** REORDER */
    if (reorderCategoryIds.size > 0) {
      const categoriesToReorder = updatedCategories
        .filter((c) => reorderCategoryIds.has(c.id.toString()))
        .map((c) => {
          if (moveToEndIds.has(c.id.toString())) {
            return { ...c, order: c.order + 99999 } // Сдвигаем виртуально
          }
          return c
        })

      sideEffects.push(this.reorderService.reorder('board', categoriesToReorder, userId, session))
    }

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    const updatedCategoriesPopulated = await this.getByCriteria(
      { ids: categoryIds },
      userId,
      session,
    )

    return {
      data: updatedCategoriesPopulated,
      logId: log.id,
    }
  }

  public async editMany(
    data: CategoryEditDTO[],
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session),
      )
    }
  }

  public async regenerateReferencesByBoards(
    categoryIds: string[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const categories = await this.repository.findByCriteria(
      { ids: categoryIds },
      session,
      undefined,
      userId,
    )
    if (!categories.length) return

    const boardIds = [...new Set(categories.map((c) => c.board.toString()))]

    const boards = await this.boardService.getByCriteria({
      ids: boardIds,
    })

    const boardMap = new Map(boards.map((b) => [b.id.toString(), b]))

    const bulkUpdates = categories.reduce(
      (acc, category) => {
        const board = boardMap.get(category.board.toString())

        if (board) {
          acc.push({
            id: category.id,
            board: board.id,
            workspace: board.workspace.id,
          })
        }
        return acc
      },
      [] as SingleUpdateDTO<SafeUpdateData<ICategory>>[],
    )

    if (bulkUpdates.length > 0) {
      return await this.repository.bulkUpdate(bulkUpdates, userId, session)
    }

    return null
  }

  private async _executeDeleteTransaction(
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    const categoriesToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (categoriesToDelete.length === 0) {
      throw new NotFoundError('Категории для удаления не найдены.')
    }

    const uniqueBoardIds = [...new Set(categoriesToDelete.map((t) => t.board.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    await this.repository.deleteMany(criteria, userId, session)

    await Promise.all([
      ...this._updateCategoriesParentCounters(categoriesToDelete, userId, session),

      this.taskService.deleteTasksByCriteria(
        { categoryIds: categoriesToDelete.map((c) => c.id.toString()) },
        userId,
        session,
      ),

      this.reorderService.reorderByParentIds(uniqueBoardIds, 'board', userId, session),
    ])
  }

  public async delete(
    criteria: ICategoryCriteria,
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
    criteria: ICategoryCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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

    const categoriesToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    const categoriesCriteria = { categoryIds: categoriesToProcess.map((b) => b.id.toString()) }

    if (categoriesToProcess.length === 0) throw new NotFoundError('Категории не найдены.')

    await Promise.all([
      /* PROCESS CHILDREN */
      this.taskService.updateLifecycleTasksByCriteria(
        categoriesCriteria,
        { ...data, isDeletedExternal: isRecover ? false : true },
        userId,
        session,
      ),

      /* PROCESS CATEGORIES */
      this.repository.updateManyByCriteria(criteria, data, session, userId),
    ])

    const sideEffects: Promise<any>[] = []

    const entitiesAfter = categoriesToProcess.map((category) => ({
      ...category,
      isDeleted: data.isDeleted,
    }))

    /* REORDER */
    sideEffects.push(
      this.reorderService.reorderByParentIds(
        categoriesToProcess.map((c) => c.board),
        'board',
        userId,
        session,
      ),
    )

    /** UPDATE COUNTERS */
    sideEffects.push(...this._updateCategoriesParentCounters(categoriesToProcess, userId, session))

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesToProcess,
        entitiesAfter,
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedCategoriesPopulated = await this.getByCriteria(
      { ids: entitiesAfter.map((c) => c.id.toString()) },
      userId,
      session,
    )

    return {
      data: updatedCategoriesPopulated,
      logId: log.id,
    }
  }

  public async archive(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const dependencies: Types.ObjectId[] = []

    const categoriesToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId,
    )

    if (categoriesToClone.length === 0)
      throw new NotFoundError('Категории для клонирования не найдены.')

    const categoriesGroupedByBoard: Map<string, (ICategory & { embeddings: number[] })[]> =
      new Map()
    categoriesToClone.forEach((category) => {
      const boardId = category.board.toString()

      if (!categoriesGroupedByBoard.has(boardId)) {
        categoriesGroupedByBoard.set(boardId, [])
      }

      categoriesGroupedByBoard.get(boardId)!.push(category)
    })

    const transformedCategories: Omit<ICategory & { embeddings: number[] }, 'id'>[] = []

    for (const [boardId, categories] of categoriesGroupedByBoard) {
      const boardCategories = categoriesToClone.filter((c) => c.board.toString() === boardId)

      let currentMaxOrder = boardCategories.reduce((max, t) => (t.order > max ? t.order : max), 0)

      for (const category of categories) {
        const cleanCategory = {
          ...category,
          id: undefined,
          order: ++currentMaxOrder,
        }

        transformedCategories.push(cleanCategory)
      }
    }

    const clonedCategories = await this.repository.createMany(transformedCategories, session)

    const categoryIdsMap: Map<
      string,
      {
        categoryId: Types.ObjectId
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    > = new Map()

    categoriesToClone.forEach((category, index) => {
      categoryIdsMap.set(category.id.toString(), {
        categoryId: clonedCategories[index].id,
        boardId: clonedCategories[index].board,
        workspaceId: clonedCategories[index].workspace,
      })
    })

    const cloneTasksResult = await this.taskService.cloneTasksByCategories(
      categoryIdsMap,
      userId,
      session,
    )

    if (cloneTasksResult.logId) dependencies.push(cloneTasksResult.logId)

    /* REORDER */
    await this.reorderService.reorderByParentIds(
      clonedCategories.map((c) => c.board),
      'board',
      userId,
      session,
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: clonedCategories,
        dependencies,
      },
      userId,
      session,
    )

    await Promise.all([
      logPromise,
      ...this._updateCategoriesParentCounters(clonedCategories, userId, session),
    ])

    const log = await logPromise

    const clonedCategoriesPopulated = await this.getByCriteria(
      { ids: clonedCategories.map((t) => t.id.toString()) },
      userId,
      session,
    )

    return {
      data: clonedCategoriesPopulated,
      logId: log.id,
    }
  }

  public async clone(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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

    const before = log.entitiesBefore as (Partial<ICategory> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<ICategory> & { id: Types.ObjectId })[]

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
      affectedCategoryIds: [...new Set([...idsBefore, ...idsAfter])],
    }
  }

  public async updateLifecycleCategoriesByCriteria(
    criteria: ICategoryCriteria,
    data: SafeUpdateData<ICategory>,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    await this.repository.findByCriteria(criteria, session, undefined, userId)

    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
  }

  public async deleteCategoriesByCriteria(
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<DeleteResult> {
    return await this.repository.deleteMany(criteria, userId, session)
  }

  public async cloneCategoriesByBoards(
    boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategory[]>> {
    const sourceCategories = await this.repository.findByCriteria(
      { boardIds: Array.from(boardIdsMap.keys()) },
      session,
      undefined,
      userId,
    )
    const dependencies: Types.ObjectId[] = []

    const cleanCategories = sourceCategories.map((category) => {
      const boardData = boardIdsMap.get(category.board.toString())

      if (!boardData) {
        throw new AppError('Ошибка при клонировании категорий: не найдена целевая доска.', 400)
      }

      return {
        ...category,
        board: boardData.boardId,
        workspace: boardData.workspaceId,
        _id: undefined,
      }
    })

    const clonedCategories = await this.repository.createMany(cleanCategories, session)

    const categoryIdsMap: Map<
      string,
      {
        categoryId: Types.ObjectId
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    > = new Map()

    sourceCategories.forEach((category, index) => {
      categoryIdsMap.set(category.id.toString(), {
        categoryId: clonedCategories[index].id,
        boardId: clonedCategories[index].board,
        workspaceId: clonedCategories[index].workspace,
      })
    })

    const tasksCloneResult = await this.taskService.cloneTasksByCategories(
      categoryIdsMap,
      userId,
      session,
    )

    if (tasksCloneResult.logId) dependencies.push(tasksCloneResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: clonedCategories,
        dependencies,
      },
      userId,
      session,
    )

    return {
      data: clonedCategories,
      logId: log.id,
    }
  }

  private async prepareCategoryCreationPayload(
    data: CategoryDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ICategoryCreatePayload> {
    const categoryName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(categoryName)

    const categoryPayload: ICategoryCreatePayload = {
      name: categoryName,
      workspace: Types.ObjectId.createFromHexString(data.workspaceId),
      board: Types.ObjectId.createFromHexString(data.boardId),
      order: data.order || 1,
      embeddings,
      userId,
    }

    if (data.order === undefined) {
      const lastOrder = await this.repository.getLastOrderGroupedByParents(
        [Types.ObjectId.createFromHexString(data.boardId)],
        'board',
        userId,
        session,
      )
      categoryPayload.order = lastOrder.length > 0 ? lastOrder[0].lastOrder + 1 : 1
    }

    return categoryPayload
  }

  private async prepareCategoriesCreationPayload(
    data: CategoryDTO[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ICategoryCreatePayload[]> {
    const categoriesPayloads: ICategoryCreatePayload[] = []
    const categoriesGroupedByBoard: { [key: string]: CategoryDTO[] } = {}

    data.forEach((category) => {
      const boardId = category.boardId
      if (!categoriesGroupedByBoard[boardId]) {
        categoriesGroupedByBoard[boardId] = []
      }

      categoriesGroupedByBoard[boardId].push(category)
    })

    const grouppedCategoriesCount = await this.repository.getLastOrderGroupedByParents(
      Object.keys(categoriesGroupedByBoard).map((id) => Types.ObjectId.createFromHexString(id)),
      'board',
      userId,
      session,
    )

    const categoryNames = Array.from(new Set(data.map((category) => category.name.trim())))
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(categoryNames)
    const embeddingsMap: { [key: string]: number[] } = {}
    categoryNames.forEach((name, index) => {
      embeddingsMap[name] = embeddingsArray[index]
    })

    const countMap = new Map(
      grouppedCategoriesCount.map((entry) => [entry._id.toString(), entry.lastOrder]),
    )

    for (const [boardId, categories] of Object.entries(categoriesGroupedByBoard)) {
      let currentLastOrder = countMap.get(boardId) || 1

      for (const category of categories) {
        const categoryName = category.name.trim()

        const orderToSave = category.order ?? ++currentLastOrder

        categoriesPayloads.push({
          name: categoryName,
          workspace: new Types.ObjectId(category.workspaceId),
          board: new Types.ObjectId(category.boardId),
          order: orderToSave,
          embeddings: embeddingsMap[categoryName],
          userId,
        })
      }
    }

    return categoriesPayloads
  }

  private async prepareCategoryEditPayload(
    data: CategoryEditDTO,
    categoriesToUpdate: ICategory[],
  ): Promise<SingleUpdateDTO<SafeUpdateData<ICategory>>> {
    const { id, ...rest } = data

    const categoryPayload: SingleUpdateDTO<SafeUpdateData<ICategory>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    if (data.boardId) {
      categoryPayload.board = Types.ObjectId.createFromHexString(data.boardId)
    }
    if (data.workspaceId) {
      categoryPayload.workspace = Types.ObjectId.createFromHexString(data.workspaceId)
    }

    if (data.name && categoriesToUpdate.length > 0) {
      const needEmbeddingsUpdate = categoriesToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const categoryName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(categoryName)

        categoryPayload.embeddings = embeddings
      }
    }

    return categoryPayload
  }

  private _updateCategoriesParentCountersWithOld(
    oldCategories: ICategory[],
    newCategories: ICategory[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const sideEffects: Promise<any>[] = []

    const affectedBoards = new Set<string>()
    const affectedWorkspaces = new Set<string>()

    oldCategories.forEach((c) => {
      affectedBoards.add(c.board.toString())
      affectedWorkspaces.add(c.workspace.toString())
    })

    newCategories.forEach((c) => {
      affectedBoards.add(c.board.toString())
      affectedWorkspaces.add(c.workspace.toString())
    })

    const affectedWorkspaceIds = Array.from(affectedWorkspaces).map((id) => new Types.ObjectId(id))
    const affectedBoardIds = Array.from(affectedBoards).map((id) => new Types.ObjectId(id))

    sideEffects.push(
      this.boardService.updateCategoriesCount(affectedBoardIds, userId, session),
      this.boardService.updateTasksCount(affectedBoardIds, userId, session),

      this.workspaceService.updateCategoriesCount(affectedWorkspaceIds, userId, session),
      this.workspaceService.updateTasksCount(affectedWorkspaceIds, userId, session),
    )

    return sideEffects
  }

  private _updateCategoriesParentCounters(
    categories: ICategory[],
    userId: Types.ObjectId,
    session: ClientSession,
  ) {
    const uniqueBoardIds = [...new Set(categories.map((c) => c.board.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    const uniqueWorkspaceIds = [...new Set(categories.map((c) => c.workspace.toString()))].map(
      (id) => new Types.ObjectId(id),
    )

    return [
      this.boardService.updateCategoriesCount(uniqueBoardIds, userId, session),
      this.boardService.updateTasksCount(uniqueBoardIds, userId, session),

      this.workspaceService.updateCategoriesCount(uniqueWorkspaceIds, userId, session),
      this.workspaceService.updateTasksCount(uniqueWorkspaceIds, userId, session),
    ]
  }

  public async updateTasksCount(
    categoryIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<MongooseBulkWriteResult | null> {
    if (categoryIds.length === 0) return null

    const tasksGroupped = await this.taskService.getTasksCountByCategories(
      categoryIds,
      userId,
      session,
    )

    const tasksCountMap = new Map<string, number>(
      tasksGroupped.map((tg) => [tg.parentId, tg.count]),
    )

    const bulkUpdates = categoryIds.map((categoryId) => ({
      id: categoryId,
      tasksCount: tasksCountMap.get(categoryId.toString()) || 0,
    }))

    return await this.repository.bulkUpdate(bulkUpdates, userId, session)
  }

  public async getCategoriesCountByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(boardIds, 'board', userId, session)
  }

  public async getCategoriesCountByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(workspaceIds, 'workspace', userId, session)
  }
}
