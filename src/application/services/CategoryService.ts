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
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { LexoRank } from 'lexorank'
import { CategoryMoveDTO } from '../dtos/CategoryMoveDTO.ts'

const MAX_RETRIES = 3

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
  protected workspaceService: WorkspaceService
  protected boardService: BoardService
  protected taskService: TaskService

  constructor(
    categoryRepository: CategoryRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    workspaceService: WorkspaceService,
    boardService: BoardService,
    taskService: TaskService,
  ) {
    super(categoryRepository)

    this.repository = categoryRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoriesPayload = await this.prepareCategoriesCreationPayload(
      data,
      userId,
      session,
      isDryRun,
    )

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesAfter: categoriesPayload,
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
    const newCategories = await this.repository.createMany(categoriesPayload, session)

    const sideEffects: Promise<any>[] = []

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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateManyTransaction(data, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session, isDryRun),
      )
    }
  }

  private async _executeEditTransaction(
    data: Omit<CategoryEditDTO, 'id'>,
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

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: projectProperties(updatedCategories, categoryPayload),
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
    data: Omit<CategoryEditDTO, 'id'>,
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
    isDryRun: boolean = false,
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
    const categoriesBefore: (Partial<ICategory> & { id: Types.ObjectId })[] = []
    const movedCategoryIds: string[] = []

    for (const dto of data) {
      const category = existingMap.get(dto.id)
      if (!category) continue

      const categoryPayload = await this.prepareCategoryEditManyPayload(dto, [category], isDryRun)

      const categoryBefore = projectProperties<ICategory>([category], categoryPayload)[0]

      categoriesBefore.push(categoryBefore)
      categoryPayloads.push(categoryPayload)

      const isMoving = dto.boardId !== undefined && category.board.toString() !== dto.boardId
      if (isMoving) {
        movedCategoryIds.push(dto.id)
      }
    }

    if (isDryRun) {
      const categoriesAfter = categoriesBefore.map((c) => {
        const payload = categoryPayloads.find((p) => p.id.toString() === c.id.toString())

        if (!payload) return c

        return {
          ...c,
          ...payload,
        }
      })

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesBefore: categoriesBefore,
          entitiesAfter: categoriesAfter,
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

    const projectedUpdatedCategories = updatedCategories.map(
      (c) =>
        projectProperties<ICategory>(
          [c],
          categoryPayloads.find((p) => p.id.toString() === c.id.toString())!,
        )[0],
    )

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: projectedUpdatedCategories,
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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session, isDryRun),
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
  ): Promise<IResponseWithLog<null>> {
    const categoriesToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (categoriesToDelete.length === 0) {
      throw new NotFoundError('Категории для удаления не найдены.')
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesToDelete,
        dependencies: [],
      },
      userId,
      session,
    )

    await this.repository.deleteMany(criteria, userId, session)

    await Promise.all([
      ...this._updateCategoriesParentCounters(categoriesToDelete, userId, session),

      this.taskService.deleteTasksByCriteria(
        { categoryIds: categoriesToDelete.map((c) => c.id.toString()) },
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
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<null>> {
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

      const lastCategory = boardCategories.sort((a, b) => (a.rank > b.rank ? -1 : 1))[0]
      let lastRank = LexoRank.middle()

      if (lastCategory) {
        lastRank = LexoRank.parse(lastCategory.rank)
      }

      for (const category of categories) {
        const newRank = lastRank.genNext()

        const cleanCategory = {
          ...category,
          id: undefined,
          rank: newRank.toString(),
        }

        lastRank = newRank

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

  public async move(
    dto: CategoryMoveDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    if (externalSession) {
      return this._executeMoveTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveTransaction(
    dto: CategoryMoveDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const { beforeCategoryId, afterCategoryId, id, newBoardId } = dto

    const criteria: ICategoryCriteria = {
      ids: [id, beforeCategoryId, afterCategoryId].filter((id): id is string => !!id),
    }

    const updateData: SafeUpdateData<ICategory> = {}

    const categories = await this.repository.findByCriteria(criteria, session, undefined, user.id)
    const category = categories.find((t) => t.id.toString() === id)
    const beforeCategory = categories.find((t) => t.id.toString() === beforeCategoryId)
    const afterCategory = categories.find((t) => t.id.toString() === afterCategoryId)
    let isParentChanged = false

    if (!category) {
      throw new NotFoundError('Категория для перемещения не найдена.')
    }
    if (beforeCategoryId && !beforeCategory) {
      throw new NotFoundError('Категория перед указанной не найдена.')
    }
    if (afterCategoryId && !afterCategory) {
      throw new NotFoundError('Категория после указанной не найдена.')
    }

    if (newBoardId) {
      const board = await this.boardService.getByCriteria({ id: newBoardId }, user.id, session)

      if (!board.length) {
        throw new NotFoundError('Доска для перемещения не найдена.')
      }
    }

    let newRank = LexoRank.middle()

    if (beforeCategory && afterCategory) {
      const beforeRank = LexoRank.parse(beforeCategory.rank)
      const afterRank = LexoRank.parse(afterCategory.rank)

      newRank = beforeRank.between(afterRank)
    } else if (beforeCategory) {
      const beforeRank = LexoRank.parse(beforeCategory.rank)
      newRank = beforeRank.genPrev()
    } else if (afterCategory) {
      const afterRank = LexoRank.parse(afterCategory.rank)
      newRank = afterRank.genNext()
    } else {
      newRank = LexoRank.middle()
    }

    updateData.rank = newRank.toString()

    if (newBoardId) {
      updateData.board = new Types.ObjectId(newBoardId)

      isParentChanged = true
    } else if (beforeCategory && beforeCategory.board.toString() !== category.board.toString()) {
      updateData.board = beforeCategory.board

      isParentChanged = true
    } else if (afterCategory && afterCategory.board.toString() !== category.board.toString()) {
      updateData.board = afterCategory.board

      isParentChanged = true
    }

    const categoriesBefore = projectProperties<ICategory>([category], updateData)
    const categoriesAfter = categoriesBefore.map((c) => ({
      ...c,
      ...updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesBefore: categoriesBefore,
          entitiesAfter: categoriesAfter,
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

    if (isParentChanged) {
      await this.regenerateReferencesByBoards([id], user.id, session)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: categoriesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedCategories = await this.getByCriteria({ id }, user.id, session)

    return {
      data: updatedCategories,
      logId: log.id,
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
      { boardIds: Array.from(boardIdsMap.keys()), isDeleted: false, isDeletedExternal: false },
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
        id: undefined,
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

    let categoryRank = LexoRank.middle().toString()

    /* RANKING */
    const lastCategoriesInBoard = await this.repository.findByCriteria(
      { boardId: data.boardId },
      session,
      { sort: { rank: -1 }, limit: 1 },
      userId,
    )
    if (lastCategoriesInBoard.length > 0) {
      const lastCategory = lastCategoriesInBoard[0]
      const lastRank = LexoRank.parse(lastCategory.rank)

      categoryRank = lastRank.genNext().toString()
    }

    const categoryPayload: ICategoryCreatePayload = {
      name: categoryName,
      workspace: Types.ObjectId.createFromHexString(data.workspaceId),
      board: Types.ObjectId.createFromHexString(data.boardId),
      rank: categoryRank,
      embeddings,
      userId,
    }

    return categoryPayload
  }

  private async prepareCategoriesCreationPayload(
    data: CategoryDTO[],
    userId: Types.ObjectId,
    session?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<ICategoryCreatePayload[]> {
    const categoriesPayloads: ICategoryCreatePayload[] = []
    const categoriesGroupedByBoard: { [key: string]: CategoryDTO[] } = {}
    const uniqueBoardIds = Array.from(
      new Set(data.map((category) => new Types.ObjectId(category.boardId))),
    )

    data.forEach((category) => {
      const boardId = category.boardId
      if (!categoriesGroupedByBoard[boardId]) {
        categoriesGroupedByBoard[boardId] = []
      }

      categoriesGroupedByBoard[boardId].push(category)
    })

    const embeddingsMap: { [key: string]: number[] } = {}

    if (!isDryRun) {
      const categoryNames = Array.from(new Set(data.map((category) => category.name.trim())))
      const embeddingsArray =
        await this.embeddingService.getEmbeddingsForMultipleTexts(categoryNames)
      categoryNames.forEach((name, index) => {
        embeddingsMap[name] = embeddingsArray[index]
      })
    }

    const lastRanksByBoards = await this.repository.getLastRanksByParents(
      uniqueBoardIds,
      'board',
      userId,
      session,
    )

    for (const [boardId, categories] of Object.entries(categoriesGroupedByBoard)) {
      let lastRank = LexoRank.middle()

      const lastRankData = lastRanksByBoards.find((r) => r.parentId.toString() === boardId)
      if (lastRankData) {
        lastRank = LexoRank.parse(lastRankData.rank)
      }

      for (const category of categories) {
        const newRank = lastRank.genNext()
        const categoryName = category.name.trim()

        categoriesPayloads.push({
          id: category.id,
          name: categoryName,
          workspace: new Types.ObjectId(category.workspaceId),
          board: new Types.ObjectId(category.boardId),
          rank: newRank.toString(),
          embeddings: embeddingsMap[categoryName],
          userId,
        })

        lastRank = newRank
      }
    }

    return categoriesPayloads
  }

  private async _prepareMainEditFields(
    data: Omit<CategoryEditDTO, 'id'>,
    categoryPayload: SafeUpdateData<ICategory>,
    categoriesToUpdate: ICategory[],
    isDryRun: boolean = false,
  ) {
    if (data.boardId) {
      categoryPayload.board = Types.ObjectId.createFromHexString(data.boardId)
    }
    if (data.workspaceId) {
      categoryPayload.workspace = Types.ObjectId.createFromHexString(data.workspaceId)
    }

    if (!isDryRun && data.name && categoriesToUpdate.length > 0) {
      const needEmbeddingsUpdate = categoriesToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const categoryName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(categoryName)

        categoryPayload.embeddings = embeddings
      }
    }
  }

  private async prepareCategoryEditPayload(
    data: Omit<CategoryEditDTO, 'id'>,
    categoriesToUpdate: ICategory[],
  ): Promise<SafeUpdateData<ICategory>> {
    const categoryPayload: SafeUpdateData<ICategory> = {
      ...data,
    }

    await this._prepareMainEditFields(data, categoryPayload, categoriesToUpdate)

    return categoryPayload
  }

  private async prepareCategoryEditManyPayload(
    data: CategoryEditDTO,
    categoriesToUpdate: ICategory[],
    isDryRun: boolean = false,
  ): Promise<SingleUpdateDTO<SafeUpdateData<ICategory>>> {
    const { id, ...rest } = data

    const categoryPayload: SingleUpdateDTO<SafeUpdateData<ICategory>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    await this._prepareMainEditFields(rest, categoryPayload, categoriesToUpdate, isDryRun)

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
