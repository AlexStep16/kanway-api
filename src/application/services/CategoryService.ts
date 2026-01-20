import { ICategoryRaw } from '@entities/ICategoryRaw.ts'
import CategoryRepository from '@repositories/CategoryRepository.ts'
import { CategoryDTO } from '@application/dtos/CategoryDTO.ts'
import mongoose, { ClientSession, DeleteResult, Types, UpdateWriteOpResult } from 'mongoose'
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
  protected reorderService: ReorderService<
    ICategory,
    ICategoryRaw,
    ICategoryCriteria,
    ICategoryPopulated,
    ICategoryCreatePayload
  >
  protected workspaceService: WorkspaceService
  protected boardService: BoardService
  protected taskService: TaskService

  constructor(
    categoryRepository: CategoryRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<
      ICategory,
      ICategoryRaw,
      ICategoryCriteria,
      ICategoryPopulated,
      ICategoryCreatePayload
    >,
    workspaceService: WorkspaceService,
    boardService: BoardService,
    taskService: TaskService
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
      500
    )
  }

  private async _executeCreateTransaction(
    data: CategoryDTO,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const categoryPayload = await this.prepareCategoryCreationPayload(data, userId, session)

    /* CREATE */
    const newCategory = await this.repository.create(categoryPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      await this.reorderService.reorder('board', [newCategory], userId, session)
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: [newCategory],
        dependencies: [],
      },
      userId,
      session
    )

    const newCategoriesPopulated = await this.getByCriteria(
      { id: newCategory.id.toString() },
      userId,
      session
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
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, userId, session)
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: CategoryDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoriesPayload = await this.prepareCategoriesCreationPayload(data, userId, session)

    /* CREATE */
    const newCategories = await this.repository.createMany(categoriesPayload, session)

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      await this.reorderService.reorder('board', newCategories, userId, session)
    }

    const newCategoriesPopulated = await this.getByCriteria(
      { ids: newCategories.map((t) => t.id.toString()) },
      userId,
      session
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
      userId,
      session
    )

    return {
      data: newCategoriesPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: CategoryDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session)
      )
    }
  }

  private async _executeEditTransaction(
    data: CategoryEditDTO,
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoriesToUpdate: ICategory[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId
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
      userId
    )

    if (updateManyResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить категории.', 500)

    const updatedCategories = await this.repository.findByCriteria<ICategory>(
      criteria,
      session,
      undefined,
      userId
    )

    /* MOVE */
    const categoriesToMove = categoriesToUpdate.filter(
      (b) => data.boardId !== undefined && b.board.toString() !== data.boardId
    )
    if (categoriesToMove.length > 0) {
    }

    /* REORDER */
    const categoriesToReorder = categoriesToUpdate.filter(
      (c) => data.order !== undefined && c.order !== data.order
    )

    const categoriesToMoveToEnd = categoriesToUpdate.filter(
      (c) => data.order == null && categoriesToMove.includes(c)
    )

    for (const categoryToMoveToEnd of categoriesToMoveToEnd) {
      categoryToMoveToEnd.order += 99999 // Move to end before reordering
    }

    if (categoriesToReorder.length > 0) {
      await this.reorderService.reorder(
        'board',
        [...categoriesToReorder, ...categoriesToMoveToEnd],
        userId,
        session
      )
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

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
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session)
      )
    }
  }

  private async _executeEditManyTransaction(
    data: CategoryEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoryIdsToReorder: Set<string> = new Set()
    const categoryIdsToMoveToEnd: Set<string> = new Set()
    const categoryPayloads: SingleUpdateDTO<SafeUpdateData<ICategory>>[] = []
    const categoryPayloadsToMove: SingleUpdateDTO<SafeUpdateData<ICategory>>[] = []
    const categoriesBefore: Partial<ICategory>[] = []

    const categoryIds = data.map((d) => d.id)

    const existingCategories: ICategory[] = await this.repository.findByCriteria(
      { ids: categoryIds },
      session,
      undefined,
      userId
    )

    if (existingCategories.length === 0)
      throw new NotFoundError('Категории для обновления не найдены.')

    for (const dto of data) {
      const category = existingCategories.find((c) => c.id.toString() === dto.id)

      if (!category) continue

      const categoryPayload = await this.prepareCategoryEditPayload(dto, [category])
      categoriesBefore.push(projectProperties<ICategory>([category], categoryPayload)[0])

      categoryPayloads.push(categoryPayload)

      if (dto.boardId && category.board.toString() !== dto.boardId) {
        categoryPayloadsToMove.push(categoryPayload)
      }

      if (dto.order != null && category.order !== dto.order) {
        categoryIdsToReorder.add(categoryPayload.id.toString())
      } else if (dto.order == null && categoryPayloadsToMove.includes(categoryPayload)) {
        categoryIdsToReorder.add(dto.id)
        categoryIdsToMoveToEnd.add(dto.id)
      }
    }

    /* BULK UPDATE */
    const updatedCategoriesResult = await this.repository.bulkUpdate(
      categoryPayloads,
      userId,
      session
    )

    if (!updatedCategoriesResult || updatedCategoriesResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить категории.', 500)

    const updatedCategories = await this.repository.findByCriteria(
      { ids: categoryPayloads.map((t) => t.id.toString()) },
      session,
      undefined,
      userId
    )

    /* MOVE */
    if (categoryPayloadsToMove.length > 0) {
    }

    /* REORDER */
    if (categoryIdsToReorder.size > 0) {
      for (const categoryId of categoryIdsToMoveToEnd) {
        const categoryToMoveToEnd = updatedCategories.find((c) => c.id.toString() === categoryId)

        if (categoryToMoveToEnd) {
          categoryToMoveToEnd.order += 99999 // Move to end before reordering
        }
      }

      const updatedCategoriesToReorder = updatedCategories.filter((uc) =>
        categoryIdsToReorder.has(uc.id.toString())
      )

      if (updatedCategoriesToReorder.length > 0) {
        await this.reorderService.reorder('board', updatedCategoriesToReorder, userId, session)
      }
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    const updatedCategoriesPopulated = await this.getByCriteria(
      { ids: updatedCategories.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: updatedCategoriesPopulated,
      logId: log.id,
    }
  }

  public async editMany(
    data: CategoryEditDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session)
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<void> {
    const categoriesToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId
    )

    if (categoriesToDelete.length === 0)
      throw new NotFoundError('Категории для удаления не найдены.')

    await Promise.all([
      /* DELETE DEPENDENCIES */
      this.taskService.deleteTasksByFilter(
        { categoryIds: categoriesToDelete.map((c) => c.id.toString()) },
        userId,
        session
      ),

      /* DELETE CATEGORIES */
      this.repository.deleteMany(criteria, userId, session),
    ])

    /* REORDER */
    await this.reorderService.reorderByParentIds(
      categoriesToDelete.map((c) => c.board),
      'board',
      userId,
      session
    )
  }

  public async delete(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<void> {
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
    criteria: ICategoryCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession
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
      userId
    )

    const categoriesCriteria = { categoryIds: categoriesToProcess.map((b) => b.id.toString()) }

    if (categoriesToProcess.length === 0) throw new NotFoundError('Категории не найдены.')

    await Promise.all([
      /* PROCESS CHILDREN */
      this.taskService.updateLifecycleTasksByFilter(
        categoriesCriteria,
        { ...data, isDeletedExternal: isRecover ? false : true },
        userId,
        session
      ),

      /* PROCESS CATEGORIES */
      this.repository.updateManyByCriteria(criteria, data, session, userId),
    ])

    const updatedCategories = await this.repository.findByCriteria<ICategory>(
      criteria,
      session,
      undefined,
      userId
    )

    /* REORDER */
    await this.reorderService.reorderByParentIds(
      categoriesToProcess.map((c) => c.board),
      'board',
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesToProcess,
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    const updatedCategoriesPopulated = await this.getByCriteria(
      { ids: updatedCategories.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: updatedCategoriesPopulated,
      logId: log.id,
    }
  }

  public async archive(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const dependencies: Types.ObjectId[] = []

    const categoriesToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId
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
      session
    )

    if (cloneTasksResult.logId) dependencies.push(cloneTasksResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: clonedCategories,
        dependencies,
      },
      userId,
      session
    )

    const clonedCategoriesPopulated = await this.getByCriteria(
      { ids: clonedCategories.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: clonedCategoriesPopulated,
      logId: log.id,
    }
  }

  public async clone(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
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
  ): Promise<IUndoResponse> {
    const { operationType } = log

    const before = log.entitiesBefore as (Partial<ICategory> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<ICategory> & { id: Types.ObjectId })[]

    const idsBefore = before?.map((e) => e.id?.toString()) || []
    const idsAfter = after?.map((e) => e.id?.toString()) || []

    const boardIdsSet = new Set<string>()

    const collectBoardIds = (items: ICategoryPopulated[]) => {
      items.forEach((c) => {
        const bId = (c.board as any)?._id || (c.board as any)?.id || c.board
        if (bId) boardIdsSet.add(bId.toString())
      })
    }

    switch (operationType) {
      case OperationTypesEnum.CREATE: {
        await this.delete({ ids: idsAfter }, user, session)

        after.forEach((t) => {
          if (t.board) boardIdsSet.add(t.board.toString())
        })
        break
      }

      case OperationTypesEnum.UPDATE: {
        const payload = before.map((e) => ({
          ...e,
          id: e.id?.toString(),
        }))

        const result = await this.editMany(payload, user, session)
        collectBoardIds(result.data)
        break
      }

      case OperationTypesEnum.ARCHIVE: {
        const result = await this.recover({ ids: idsBefore }, user, session)
        collectBoardIds(result.data)
        break
      }

      case OperationTypesEnum.RECOVER: {
        const result = await this.archive({ ids: idsBefore }, user, session)
        collectBoardIds(result.data)
        break
      }

      default:
        throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
    }

    return {
      affectedBoardIds: Array.from(boardIdsSet),
    }
  }

  public async updateLifecycleCategoriesByFilter(
    criteria: ICategoryCriteria,
    data: SafeUpdateData<ICategory>,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<UpdateWriteOpResult> {
    await this.repository.findByCriteria(criteria, session, undefined, userId)

    // TODO: Update Counters

    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
  }

  public async deleteCategoriesByFilter(
    criteria: ICategoryCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
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
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const sourceCategories = await this.repository.findByCriteria(
      { boardIds: Array.from(boardIdsMap.keys()) },
      session,
      undefined,
      userId
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
      session
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
      session
    )

    const clonedCategoriesPopulated = await this.getByCriteria(
      { ids: clonedCategories.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: clonedCategoriesPopulated,
      logId: log.id,
    }
  }

  private async prepareCategoryCreationPayload(
    data: CategoryDTO,
    userId: Types.ObjectId,
    session?: ClientSession
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
        session
      )
      categoryPayload.order = lastOrder.length > 0 ? lastOrder[0].lastOrder + 1 : 1
    }

    return categoryPayload
  }

  private async prepareCategoriesCreationPayload(
    data: CategoryDTO[],
    userId: Types.ObjectId,
    session?: ClientSession
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
      session
    )

    const categoryNames = Array.from(new Set(data.map((category) => category.name.trim())))
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(categoryNames)
    const embeddingsMap: { [key: string]: number[] } = {}
    categoryNames.forEach((name, index) => {
      embeddingsMap[name] = embeddingsArray[index]
    })

    const countMap = new Map(
      grouppedCategoriesCount.map((entry) => [entry._id.toString(), entry.lastOrder])
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
    categoriesToUpdate: ICategory[]
  ): Promise<SingleUpdateDTO<SafeUpdateData<ICategory>>> {
    const { id, boardId, workspaceId, ...rest } = data

    const categoryPayload: SingleUpdateDTO<SafeUpdateData<ICategory>> = {
      ...rest,

      id: new Types.ObjectId(id),
      board: boardId ? new Types.ObjectId(boardId) : undefined,
      workspace: workspaceId ? new Types.ObjectId(workspaceId) : undefined,
    }

    if (data.name && categoriesToUpdate.length > 0) {
      const needEmbeddingsUpdate = categoriesToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim()
      )

      const categoryName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(categoryName)

        categoryPayload.embeddings = embeddings
      }
    }

    return categoryPayload
  }
}
