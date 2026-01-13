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
import { ClonedCategoriesResult } from '@dtos/ClonedCategoriesResult.ts'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.ts'
import { ICategory } from '@entities/ICategory.ts'
import { IUser } from '@entities/IUser.ts'
import { ICategoriesWithChildrenResponse } from '@/application/interfaces/ICategoriesWithChildrenResponse.ts'
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
  protected reorderService: ReorderService<ICategory, ICategoryRaw, ICategoryCriteria>
  protected workspaceService: WorkspaceService
  protected boardService: BoardService
  protected taskService: TaskService

  constructor(
    categoryRepository: CategoryRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<ICategory, ICategoryRaw, ICategoryCriteria>,
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
    let reorderedCategories: ICategory[] = []

    const finalEntitiesMap = new Map<string, ICategory>()
    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const categoryPayload = await this.prepareCategoryCreationPayload(data, userId, session)

    /* CREATE */
    const newCategory = await this.repository.create(categoryPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedCategories = await this.reorderService.reorder(
        'board',
        [newCategory],
        userId,
        session
      )
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

    newCategory.tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

    finalEntitiesMap.set(newCategory.id.toString(), newCategory)

    const finalEntities = Array.from(finalEntitiesMap.values())
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
    let reorderedCategories: ICategory[] = []

    const finalEntitiesMap = new Map<string, ICategory>()
    const categoriesPayload = await this.prepareCategoriesCreationPayload(data, userId, session)

    /* CREATE */
    const newCategories = await this.repository.createMany(categoriesPayload, session)

    newCategories.forEach((nc, index) => {
      nc.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity

      finalEntitiesMap.set(nc.id.toString(), nc)
    })

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      reorderedCategories = await this.reorderService.reorder(
        'board',
        newCategories,
        userId,
        session
      )
    }

    if (reorderedCategories.length > 0) {
      reorderedCategories.forEach((reorderedCategory) => {
        finalEntitiesMap.set(reorderedCategory.id.toString(), reorderedCategory)
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
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: newCategories,
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
    let reorderedCategories: ICategory[] = []

    const finalEntitiesMap = new Map<string, ICategory>()

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
    const updatedEntities = await this.repository.findByCriteria<ICategory>(criteria, session)

    if (updateManyResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить категории.', 500)

    updatedEntities.forEach((ne) => {
      finalEntitiesMap.set(ne.id.toString(), ne)
    })

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
      reorderedCategories = await this.reorderService.reorder(
        'board',
        [...categoriesToReorder, ...categoriesToMoveToEnd],
        userId,
        session
      )

      reorderedCategories.forEach((reorderedCategory) => {
        finalEntitiesMap.set(reorderedCategory.id.toString(), reorderedCategory)
      })
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesBefore,
        entitiesAfter: finalEntities,
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
    const categoriesPayload: SingleUpdateDTO<SafeUpdateData<ICategory>>[] = []
    const categoriesPayloadToMove: SingleUpdateDTO<SafeUpdateData<ICategory>>[] = []
    let reorderedCategories: ICategory[] = []

    const finalEntitiesMap = new Map<string, ICategory>()
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

      categoriesPayload.push(categoryPayload)

      if (dto.boardId && category.board.toString() !== dto.boardId) {
        categoriesPayloadToMove.push(categoryPayload)
      }

      if (dto.order != null && category.order !== dto.order) {
        categoryIdsToReorder.add(categoryPayload.id.toString())
      } else if (dto.order == null && categoriesPayloadToMove.includes(categoryPayload)) {
        categoryIdsToReorder.add(dto.id)
        categoryIdsToMoveToEnd.add(dto.id)
      }
    }

    /* BULK UPDATE */
    const updatedCategoriesResult = await this.repository.bulkUpdate(
      categoriesPayload,
      userId,
      session
    )

    if (!updatedCategoriesResult || updatedCategoriesResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить категории.', 500)

    const updatedCategories = await this.repository.findByCriteria(
      { ids: categoriesPayload.map((t) => t.id.toString()) },
      session,
      undefined,
      userId
    )

    updatedCategories.forEach((uc) => {
      finalEntitiesMap.set(uc.id.toString(), uc)
    })

    /* MOVE */
    if (categoriesPayloadToMove.length > 0) {
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
        reorderedCategories = await this.reorderService.reorder(
          'board',
          updatedCategoriesToReorder,
          userId,
          session
        )

        reorderedCategories.forEach((reorderedCategory) => {
          finalEntitiesMap.set(reorderedCategory.id.toString(), reorderedCategory)
        })
      }
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

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
  ): Promise<ICategoryPopulated[]> {
    let reorderedCategories: ICategory[] = []

    const categoriesToDelete = await this.repository.findByCriteria(criteria, session)

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
    reorderedCategories = await this.reorderService.reorderByParentIds(
      categoriesToDelete.map((c) => c.board),
      'board',
      userId,
      session
    )

    const reorderedCategoriesPopulated = await this.getByCriteria(
      { ids: reorderedCategories.map((t) => t.id.toString()) },
      userId,
      session
    )

    return reorderedCategoriesPopulated
  }

  public async delete(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<ICategoryPopulated[]> {
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
  ): Promise<IResponseWithLog<ICategoriesWithChildrenResponse>> {
    let reorderedCategories: ICategory[] = []

    const finalEntitiesMap = new Map<string, ICategory>()
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

    const categoriesToProcess = await this.repository.findByCriteria(criteria, session)

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

    updatedCategories.forEach((updatedCategory) => {
      finalEntitiesMap.set(updatedCategory.id.toString(), updatedCategory)
    })

    /* REORDER */
    reorderedCategories = await this.reorderService.reorderByParentIds(
      categoriesToProcess.map((c) => c.board),
      'board',
      userId,
      session
    )

    reorderedCategories.forEach((reorderedCategory) => {
      finalEntitiesMap.set(reorderedCategory.id.toString(), reorderedCategory)
    })

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

    const updatedTasks = await this.taskService.getByCriteria(criteria, userId, session)

    const finalEntities = Array.from(finalEntitiesMap.values())
    const finalEntitiesPopulated = await this.getByCriteria(
      { ids: finalEntities.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: {
        categories: finalEntitiesPopulated,
        tasks: updatedTasks,
      },
      logId: log.id,
    }
  }

  public async archive(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoriesWithChildrenResponse>> {
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
  ): Promise<IResponseWithLog<ICategoriesWithChildrenResponse>> {
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
  ): Promise<IResponseWithLog<ClonedCategoriesResult>> {
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

    const categoriesGroupedByBoard: Map<string, ICategory[]> = new Map()
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

    const newCategories = await this.repository.createMany(transformedCategories, session)

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
        categoryId: newCategories[index].id,
        boardId: newCategories[index].board,
        workspaceId: newCategories[index].workspace,
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
        entitiesAfter: newCategories,
        dependencies,
      },
      userId,
      session
    )

    const finalObj = {
      categories: newCategories,
      tasks: cloneTasksResult.data,
    }

    return {
      data: finalObj,
      logId: log.id,
    }
  }

  public async clone(
    criteria: ICategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ClonedCategoriesResult>> {
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
  ): Promise<IUndoResponse<Partial<ICategoriesWithChildrenResponse>>> {
    const entitiesBefore = log.entitiesBefore as (Partial<ICategory> & { id: Types.ObjectId })[]
    const entitiesAfter = log.entitiesAfter as ICategory[]

    const categoryBeforeIds = entitiesBefore.map((e) => e.id.toString())
    const categoryAfterIds = entitiesAfter.map((e) => e.id.toString())
    const operationType = log.operationType

    if (operationType === OperationTypesEnum.CREATE) {
      const deleteResult = await this.delete({ ids: categoryAfterIds }, user, session)
      const deletedIds = deleteResult.map((t) => t.id.toString())

      const populatedCategories = await this.getByCriteria(
        { ids: [...deleteResult, ...entitiesAfter].map((t) => t.id.toString()) },
        user.id,
        session
      )

      return {
        delete: {
          categories: populatedCategories.filter((t) => categoryAfterIds.includes(t.id.toString())),
        },
        update: {
          categories: populatedCategories.filter((t) => deletedIds.includes(t.id.toString())),
        },
      }
    } else if (operationType === OperationTypesEnum.UPDATE) {
      const entitiesBeforeToEditSchema = entitiesBefore.map((e) => {
        return {
          ...e,
          id: e.id.toString(),
          boardId: e.board?.toString(),
          workspaceId: e.workspace?.toString(),
        }
      })

      const editResult = await this.editMany(entitiesBeforeToEditSchema, user, session)

      return {
        update: { categories: editResult.data },
      }
    } else if (operationType === OperationTypesEnum.ARCHIVE) {
      const recoverResult = await this.recover({ ids: categoryBeforeIds }, user, session)

      return {
        update: { categories: recoverResult.data.categories },
      }
    } else if (operationType === OperationTypesEnum.RECOVER) {
      const archiveResult = await this.archive({ ids: categoryBeforeIds }, user, session)

      return {
        update: archiveResult.data,
      }
    } else throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
  }

  public async updateCategoriesByFilter(
    criteria: ICategoryCriteria,
    data: Partial<ICategory>,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<UpdateWriteOpResult> {
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
  ): Promise<IResponseWithLog<ClonedCategoriesResult>> {
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

    return {
      data: {
        categories: clonedCategories,
        tasks: tasksCloneResult.data,
      },
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

    for (const [boardId, categories] of Object.entries(categoriesGroupedByBoard)) {
      const existingCountEntry = grouppedCategoriesCount.find(
        (entry) => entry._id.toString() === boardId
      )
      let newOrder = existingCountEntry ? existingCountEntry.lastOrder : 0

      categories.forEach((category) => {
        if (category.order === undefined) {
          category.order = ++newOrder
        }
      })

      for (const category of categories) {
        const categoryName = category.name.trim()
        const categoryPayload: ICategoryCreatePayload = {
          name: categoryName,
          workspace: Types.ObjectId.createFromHexString(category.workspaceId),
          board: Types.ObjectId.createFromHexString(category.boardId),
          order: category.order || 1,
          embeddings: embeddingsMap[categoryName],
          userId,
        }
        categoriesPayloads.push(categoryPayload)
      }
    }

    return categoriesPayloads
  }

  private async prepareCategoryEditPayload(
    data: CategoryEditDTO,
    categoriesToUpdate: ICategory[]
  ): Promise<SingleUpdateDTO<SafeUpdateData<ICategory>>> {
    const categoryPayload: SingleUpdateDTO<SafeUpdateData<ICategory>> = {
      ...data,
      id: Types.ObjectId.createFromHexString(data.id),
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
