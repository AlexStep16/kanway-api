import { ICategoryRaw } from '@entities/ICategoryRaw.js'
import CategoryRepository from '@repositories/CategoryRepository.js'
import { CategoryDTO } from '@application/dtos/CategoryDTO.js'
import mongoose, { ClientSession, DeleteResult, Types, UpdateWriteOpResult } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.js'
import { ICategoryCriteria } from '@criterias/ICategoryCriteria.js'
import { OperationLogService } from '@application/services/OperationLogService.js'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.js'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.js'
import { NotFoundError } from '@errors/NotFound.js'
import { TaskService } from '@application/services/TaskService.js'
import { BoardService } from '@application/services/BoardService.js'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.js'
import { ICategory } from '@entities/ICategory.js'
import { IUser } from '@entities/IUser.js'
import { projectProperties } from '@/utils/projectProperties.js'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'
import { IOperationLog } from '@entities/IOperationLog.js'
import { AppError } from '@/domain/errors/AppError.js'
import { LifecycleDTO } from '@dtos/LifecycleDTO.js'
import { WorkspaceService } from '@application/services/WorkspaceService.js'
import { BaseService } from '@application/services/BaseService.js'
import { ICategoryPopulated } from '@interfaces/ICategoryPopulated.js'
import { ICategoryCreatePayload } from '@interfaces/ICategoryCreatePayload.js'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'
import { LexoRank } from 'lexorank'
import { CategoryMoveDTO } from '../dtos/CategoryMoveDTO.js'
import { LimitService } from './LimitService.js'

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
  protected limitService: LimitService

  constructor(
    categoryRepository: CategoryRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    workspaceService: WorkspaceService,
    boardService: BoardService,
    taskService: TaskService,
    limitService: LimitService,
  ) {
    super(categoryRepository)

    this.repository = categoryRepository
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
    data: CategoryDTO,
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    /** LIMITS CHECK */
    await this.limitService.checkCategoriesLimit(user, data.boardId, session)

    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const categoryPayload = await this.prepareCategoryCreationPayload(data, user.id, session)

    /* CREATE */
    const newCategory = await this.repository.create(categoryPayload, session)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: [newCategory],
        dependencies: [],
      },
      user.id,
      session,
    )

    const newCategoriesPopulated = await this.getByCriteria(
      { id: newCategory.id.toString() },
      user.id,
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
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session),
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: CategoryDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    await this._checkCategoriesLimitByBoards(data, user, session)

    const categoriesPayload = await this.prepareCategoriesCreationPayload(
      data,
      user.id,
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
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    /* CREATE */
    const newCategories = await this.repository.createMany(categoriesPayload, session)

    const newCategoriesPopulated = await this.getByCriteria(
      { ids: newCategories.map((t) => t.id.toString()) },
      user.id,
      session,
    )

    newCategoriesPopulated.forEach((nc, index) => {
      nc.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity
    })

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: newCategories,
        dependencies: [],
      },
      user.id,
      session,
    )

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
    if (externalSession) {
      return this._executeCreateManyTransaction(data, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, user, session, isDryRun),
      )
    }
  }

  private async _checkCategoriesLimitByBoards(
    data: { boardId: string }[],
    user: IUser,
    session: ClientSession,
  ) {
    if (data.length === 0) return

    const uniqueBoardIds = [...new Set(data.map((task) => task.boardId))]

    const incomingCounts: Record<string, number> = {}
    for (const board of data) {
      incomingCounts[board.boardId] = (incomingCounts[board.boardId] || 0) + 1
    }

    await this.limitService.checkCategoriesLimitByBoards(
      user,
      uniqueBoardIds,
      incomingCounts,
      session,
    )
  }

  private async _executeEditTransaction(
    data: Omit<CategoryEditDTO, 'id'>,
    criteria: ICategoryCriteria,
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoriesToUpdate: ICategory[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
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
      user.id,
    )

    if (updateManyResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить категории.', 500)

    const sideEffects: Promise<any>[] = []

    /* MOVE */
    const categoriesToMove = categoriesToUpdate.filter(
      (b) => data.boardId !== undefined && b.board.toString() !== data.boardId,
    )

    if (categoriesToMove.length > 0) {
      await this.moveCategoriesByBoards(
        categoriesToMove.map((category) => category.id.toString()),
        user,
        session,
        true,
      )

      const affectedTasks = await this.taskService.getByCriteria(
        {
          categoryIds: categoriesToMove.map((c) => c.id.toString()),
        },
        user.id,
        session,
        { projection: { _id: 1 } },
      )

      sideEffects.push(
        this.taskService.moveTasksByCategories(
          affectedTasks.map((t) => t.id.toString()),
          user,
          session,
        ),
      )
    }

    const updatedCategories = await this.repository.findByCriteria<ICategory>(
      criteria,
      session,
      undefined,
      user.id,
    )

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: projectProperties(updatedCategories, categoryPayload),
        dependencies: [],
      },
      user.id,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    const updatedCategoriesPopulated = await this.getByCriteria(criteria, user.id, session)

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
    if (externalSession) {
      return this._executeEditTransaction(data, criteria, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, user, session),
      )
    }
  }

  private async _executeEditManyTransaction(
    data: CategoryEditDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoryIds = data.map((d) => d.id)

    const existingCategories = await this.repository.findByCriteria(
      { ids: categoryIds },
      session,
      undefined,
      user.id,
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
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    const updatedCategoriesResult = await this.repository.bulkUpdate(
      categoryPayloads,
      user.id,
      session,
    )

    if (!updatedCategoriesResult || updatedCategoriesResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить категории.', 500)
    }

    const sideEffects: Promise<any>[] = []

    /** MOVE */
    if (movedCategoryIds.length > 0) {
      await this.moveCategoriesByBoards(movedCategoryIds, user, session, true)

      const affectedTasks = await this.taskService.getByCriteria(
        { categoryIds: movedCategoryIds },
        user.id,
        session,
        { projection: { _id: 1 } },
      )

      if (affectedTasks.length > 0) {
        sideEffects.push(
          this.taskService.moveTasksByCategories(
            affectedTasks.map((t) => t.id.toString()),
            user,
            session,
          ),
        )
      }
    }

    const updatedCategories = await this.repository.findByCriteria(
      { ids: categoryPayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      user.id,
    )

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
      user.id,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    const updatedCategoriesPopulated = await this.getByCriteria(
      { ids: categoryIds },
      user.id,
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
    if (externalSession) {
      return this._executeEditManyTransaction(data, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, user, session, isDryRun),
      )
    }
  }

  public async moveCategoriesByBoards(
    categoryIds: string[],
    user: IUser,
    session: ClientSession,
    isRerank = false,
  ) {
    const categories = await this.repository.findByCriteria(
      { ids: categoryIds },
      session,
      {
        sort: { rank: 1 },
      },
      user.id,
    )
    if (!categories.length) return

    const boardIds = [...new Set(categories.map((c) => c.board))]

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

    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<ICategory>>[] = []
    const categoriesWithNewBoard: { boardId: string }[] = []

    for (const category of categories) {
      const boardIdStr = category.board.toString()
      const board = boardMap.get(boardIdStr)

      if (!board) continue

      const update: SingleUpdateDTO<SafeUpdateData<ICategory>> = {
        id: category.id,
        board: board.id,
        workspace: board.workspace.id,
      }

      if (category.board.toString() !== board.id.toString()) {
        categoriesWithNewBoard.push({ boardId: board.id.toString() })
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
      await this._checkCategoriesLimitByBoards(categoriesWithNewBoard, user, session)

      return await this.repository.bulkUpdate(bulkUpdates, user.id, session)
    }

    return null
  }

  private async _executeDeleteTransaction(
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
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

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.DELETE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesToDelete,
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
    criteria: ICategoryCriteria,
    isRecover: boolean,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
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
      user.id,
    )

    if (isRecover) {
      await this._checkCategoriesLimitByBoards(
        categoriesToProcess.map((c) => ({ boardId: c.board.toString() })),
        user,
        session,
      )
    }

    const categoriesCriteria = { categoryIds: categoriesToProcess.map((b) => b.id.toString()) }

    if (categoriesToProcess.length === 0) throw new NotFoundError('Категории не найдены.')

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const entitiesBefore = projectProperties<ICategory>(categoriesToProcess, data)
    const entitiesAfter = entitiesBefore.map((c) => ({ ...c, ...data }))

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.CATEGORIES,
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
        categoriesCriteria,
        { ...data, isDeletedExternal: isRecover ? false : true },
        user.id,
        session,
      ),

      /* PROCESS CATEGORIES */
      this.repository.updateManyByCriteria(criteria, data, session, user.id),
    ])

    const sideEffects: Promise<any>[] = []

    await Promise.all(sideEffects)

    const updatedCategoriesPopulated = await this.getByCriteria(
      { ids: entitiesAfter.map((c) => c.id.toString()) },
      user.id,
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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, user, session, isDryRun),
      )
    }
  }

  public async recover(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, user, session, isDryRun),
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: ICategoryCriteria,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const dependencies: Types.ObjectId[] = []

    const categoriesToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: isDryRun ? '-createdAt -updatedAt' : '+embeddings -createdAt -updatedAt',
      },
      user.id,
    )

    /** LIMITS CHECK */
    await this._checkCategoriesLimitByBoards(
      categoriesToClone.map((c) => ({ boardId: c.board.toString() })),
      user,
      session,
    )

    if (categoriesToClone.length === 0)
      throw new NotFoundError('Категории для клонирования не найдены.')

    const categoriesGrouppedByBoard: Map<string, (ICategory & { embeddings: number[] })[]> =
      new Map()
    categoriesToClone.forEach((category) => {
      const boardId = category.board.toString()

      if (!categoriesGrouppedByBoard.has(boardId)) {
        categoriesGrouppedByBoard.set(boardId, [])
      }

      categoriesGrouppedByBoard.get(boardId)!.push(category)
    })

    const uniqueBoardIds = [...new Set(categoriesToClone.map((c) => c.board))]
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

    const transformedCategories: ICategoryCreatePayload[] = []

    for (const [boardId, categories] of categoriesGrouppedByBoard) {
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i]
        const id = tempIds[i] || undefined

        const lastRankInMap = lastRankMap.get(boardId)
        let nextRank: string

        if (lastRankInMap) {
          nextRank = LexoRank.parse(lastRankInMap).genNext().toString()
        } else {
          nextRank = LexoRank.middle().toString()
        }

        lastRankMap.set(boardId, nextRank)

        const cleanCategory = {
          ...category,
          id: isDryRun ? category.id.toString() : id,
          name: `${category.name} (Копия)`,
          rank: nextRank,
        }

        transformedCategories.push(cleanCategory)
      }
    }

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CLONE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesAfter: transformedCategories,
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
      user.id,
      session,
    )

    if (cloneTasksResult.logId) dependencies.push(cloneTasksResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CLONE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: clonedCategories,
        dependencies,
      },
      user.id,
      session,
    )

    const clonedCategoriesPopulated = await this.getByCriteria(
      { ids: clonedCategories.map((c) => c.id.toString()) },
      user.id,
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
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    if (externalSession) {
      return this._executeCloneTransaction(criteria, user, externalSession, isDryRun, tempIds)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, user, session, isDryRun, tempIds),
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
    const { beforeId, afterId, id, newBoardId } = dto

    const categoryIds = [id, beforeId, afterId].filter(Boolean) as string[]
    const categories = await this.repository.findByCriteria(
      { ids: categoryIds },
      session,
      undefined,
      user.id,
    )

    const category = categories.find((t) => t.id.toString() === id)
    const beforeCategory = beforeId ? categories.find((t) => t.id.toString() === beforeId) : null
    const afterCategory = afterId ? categories.find((t) => t.id.toString() === afterId) : null

    if (!category) throw new NotFoundError('Категория не найдена.')

    let newRank: LexoRank

    if (beforeCategory && afterCategory) {
      newRank = LexoRank.parse(beforeCategory.rank).between(LexoRank.parse(afterCategory.rank))
    } else if (beforeCategory) {
      newRank = LexoRank.parse(beforeCategory.rank).genPrev()
    } else if (afterCategory) {
      newRank = LexoRank.parse(afterCategory.rank).genNext()
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

    const updateData: SafeUpdateData<ICategory> = {
      rank: newRank.toString(),
    }

    if (newBoardId) {
      const [board] = await this.boardService.getByCriteria({ id: newBoardId }, user.id, session)
      if (!board) throw new NotFoundError('Доска не найдена.')

      updateData.board = board.id
      updateData.workspace = board.workspace.id
    }

    const categoriesBefore = projectProperties<ICategory>([category], updateData)
    const categoriesAfter = categoriesBefore.map((t) => ({
      ...t,
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
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<any>> {
    const { operationType } = log

    const before = log.entitiesBefore as (Partial<ICategory> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<ICategory> & { id: Types.ObjectId })[]

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

  public async getCategoriesCountByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<{ parentId: string; count: number }[]> {
    return this.repository.getCountGroupedByParents(boardIds, 'board', userId, session)
  }
}
