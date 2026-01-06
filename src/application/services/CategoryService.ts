import { ICategoryRaw } from '@entities/ICategoryRaw.ts'
import CategoryRepository from '@repositories/CategoryRepository.ts'
import { CategoryDTO } from '@application/dtos/CategoryDTO.ts'
import mongoose, { ClientSession, FilterQuery, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { CategoryCriteria } from '@criterias/CategoryCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { BoardService } from '@application/services/BoardService.ts'
import { ClonedCategoriesResult } from '@dtos/ClonedCategoriesResult.ts'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.ts'
import { ICategory } from '@entities/ICategory.ts'
import { IUser } from '@entities/IUser.ts'
import { ICategoriesWithChildrenResponse } from '@/application/interfaces/ICategoriesWithChildrenResponse.ts'
import { ICategoryWithTempClientId } from '@application/interfaces/ICategoryWithTempClientId.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'

const MAX_RETRIES = 3

export class CategoryService
  implements
    IBaseService<
      ICategory,
      CategoryCriteria,
      CategoryDTO,
      CategoryEditDTO,
      ClonedCategoriesResult,
      ICategoriesWithChildrenResponse
    >
{
  protected repository: CategoryRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<ICategoryRaw>
  protected boardService: BoardService
  protected taskService: TaskService

  constructor(
    categoryRepository: CategoryRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<ICategoryRaw>,
    boardService: BoardService,
    taskService: TaskService
  ) {
    this.repository = categoryRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.boardService = boardService
    this.taskService = taskService
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
    data: CategoryDTO,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoryWithTempClientId[]>> {
    let reorderedCategories: ICategoryRaw[] = []

    const finalEntitiesMap = new Map<string, ICategory>()
    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    const categoryPayload = await this.prepareCategoryCreationPayload(data, userId, session)

    /* CREATE */
    const newCategory = await this.repository.create(categoryPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedCategories = await this.reorderService.reorder(
        'board_id',
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

    const toServerCaseCategory = toServerCaseKeys<ICategoryWithTempClientId>(newCategory)
    toServerCaseCategory.tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

    finalEntitiesMap.set(toServerCaseCategory.id.toString(), toServerCaseCategory)

    if (reorderedCategories.length > 0) {
      reorderedCategories.forEach((reorderedCategory) => {
        finalEntitiesMap.set(
          reorderedCategory._id.toString(),
          toServerCaseKeys<ICategory>(reorderedCategory)
        )
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log[0].id,
    }
  }

  public async create(
    data: CategoryDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoryWithTempClientId[]>> {
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
  ): Promise<IResponseWithLog<ICategoryWithTempClientId[]>> {
    let reorderedCategories: ICategoryRaw[] = []

    const finalEntitiesMap = new Map<string, ICategory>()
    const categoriesPayload = await this.prepareCategoriesCreationPayload(data, userId, session)

    /* CREATE */
    const newCategories = await this.repository.createMany(categoriesPayload, session)

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      reorderedCategories = await this.reorderService.reorder(
        'board_id',
        newCategories,
        userId,
        session
      )
    }

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

    const toServerCaseKeysCategories = newCategories.map((nc, index) => {
      const transformed = toServerCaseKeys<ICategoryWithTempClientId>(nc)

      transformed.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity

      return transformed
    })

    toServerCaseKeysCategories.forEach((category) => {
      finalEntitiesMap.set(category.id.toString(), category)
    })

    if (reorderedCategories.length > 0) {
      reorderedCategories.forEach((reorderedCategory) => {
        finalEntitiesMap.set(
          reorderedCategory._id.toString(),
          toServerCaseKeys<ICategory>(reorderedCategory)
        )
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log[0].id,
    }
  }

  public async createMany(
    data: CategoryDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategory[]>> {
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
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategory[]>> {
    let reorderedCategories: ICategoryRaw[] = []

    const finalEntitiesMap = new Map<string, ICategoryRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const categoriesToUpdate: ICategoryRaw[] = await this.repository.find(filter, session)

    if (categoriesToUpdate.length === 0)
      throw new NotFoundError('Категории для редактирования не найдены.')

    const categoryPayload = await this.prepareCategoryEditPayload(data, categoriesToUpdate)
    const categoriesBefore = projectProperties<ICategoryRaw>(categoriesToUpdate, categoryPayload)

    /* UPDATE */
    const newEntities = await this.repository.updateByFilter(filter, categoryPayload, session)
    const newEntity = newEntities[0]

    if (!newEntity) return { data: [], logId: null }

    newEntities.forEach((ne) => {
      finalEntitiesMap.set(ne._id.toString(), ne)
    })

    // Update children parent references if name is changing
    if (data.name && categoriesToUpdate.length > 0) {
      const categoryIdsToUpdate = categoriesToUpdate.map((c) => c._id)

      for (const category of categoriesToUpdate) {
        if (category.name !== data.name) {
          await this.taskService.updateTasksCategoryName(
            categoryIdsToUpdate,
            data.name,
            userId,
            session
          )
        }
      }
    }

    /* MOVE */
    const categoriesToMove = categoriesToUpdate.filter(
      (b) => data.boardId !== undefined && b.board_id.toString() !== data.boardId
    )
    if (categoriesToMove.length > 0) {
      const movedCategories = await this.moveCategoriesToBoard(
        categoriesToMove.map((c) => c._id),
        {
          boardId: newEntity.board_id,
          boardName: newEntity.board_name,
          workspaceId: newEntity.workspace_id,
          workspaceName: newEntity.workspace_name,
        },
        userId,
        session
      )

      movedCategories.forEach((movedCategory) => {
        finalEntitiesMap.set(movedCategory._id.toString(), movedCategory)
      })
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
        'board_id',
        [...categoriesToReorder, ...categoriesToMoveToEnd],
        userId,
        session
      )

      reorderedCategories.forEach((reorderedCategory) => {
        finalEntitiesMap.set(reorderedCategory._id.toString(), reorderedCategory)
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

    return {
      data: finalEntities.map(toServerCaseKeys<ICategory>),
      logId: log[0].id,
    }
  }

  public async edit(
    data: CategoryEditDTO,
    criteria: CategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategory[]>> {
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
  ): Promise<IResponseWithLog<ICategory[]>> {
    const categoryIdsToReorder: Set<string> = new Set()
    const categoryIdsToMoveToEnd: Set<string> = new Set()
    const categoriesPayloadToMove: SingleUpdateDTO<Partial<ICategoryRaw>>[] = []
    let reorderedCategories: ICategoryRaw[] = []

    const finalEntitiesMap = new Map<string, ICategoryRaw>()
    const categoriesToUpdate: SingleUpdateDTO<Partial<ICategoryRaw>>[] = []
    const categoriesBefore: Partial<ICategoryRaw>[] = []
    const categoriesNameMap = new Map<
      string,
      {
        id: Types.ObjectId
        name: string
      }
    >()

    const categoryIds = data.map((d) => d.id)

    const filter = this.repository.buildFilter({ ids: categoryIds }, userId)

    const existingCategories: ICategoryRaw[] = await this.repository.find(filter, session)

    if (existingCategories.length === 0)
      throw new NotFoundError('Категории для обновления не найдены.')

    for (const dto of data) {
      const category = existingCategories.find((c) => c._id.toString() === dto.id)

      if (!category) continue

      const categoryPayload = await this.prepareCategoryEditPayload(dto, [category])
      categoriesBefore.push(projectProperties<ICategoryRaw>([category], categoryPayload)[0])

      categoriesToUpdate.push(categoryPayload)

      if (dto.boardId && category.board_id.toString() !== dto.boardId) {
        categoriesPayloadToMove.push(categoryPayload)
      }

      if (dto.order != null && category.order !== dto.order) {
        categoryIdsToReorder.add(categoryPayload._id.toString())
      } else if (dto.order == null && categoriesPayloadToMove.includes(categoryPayload)) {
        categoryIdsToReorder.add(dto.id)
        categoryIdsToMoveToEnd.add(dto.id)
      }

      // Update children parent references if name is changing
      if (dto.name && category.name !== dto.name) {
        categoriesNameMap.set(category._id.toString(), { id: category._id, name: dto.name })
      }
    }

    /* BULK UPDATE */
    const updatedCategories = await this.repository.bulkUpdate(categoriesToUpdate, userId, session)

    updatedCategories.forEach((uc) => {
      finalEntitiesMap.set(uc._id.toString(), uc)
    })

    await this.taskService.bulkUpdateTasksCategoryNameByMap(categoriesNameMap, userId, session)

    /* MOVE */
    if (categoriesPayloadToMove.length > 0) {
      const movedCategories = await this.moveCategoriesToBoardBulk(
        categoriesPayloadToMove as (SingleUpdateDTO<Partial<ICategoryRaw>> & {
          board_id: Types.ObjectId
          board_name: string
        })[],
        userId,
        session
      )

      movedCategories.forEach((movedCategory) => {
        finalEntitiesMap.set(movedCategory._id.toString(), movedCategory)
      })
    }

    /* REORDER */
    if (categoryIdsToReorder.size > 0) {
      for (const categoryId of categoryIdsToMoveToEnd) {
        const categoryToMoveToEnd = updatedCategories.find((c) => c._id.toString() === categoryId)

        if (categoryToMoveToEnd) {
          categoryToMoveToEnd.order += 99999 // Move to end before reordering
        }
      }

      const updatedCategoriesToReorder = updatedCategories.filter((uc) =>
        categoryIdsToReorder.has(uc._id.toString())
      )

      if (updatedCategoriesToReorder.length > 0) {
        reorderedCategories = await this.reorderService.reorder(
          'board_id',
          updatedCategoriesToReorder,
          userId,
          session
        )

        reorderedCategories.forEach((reorderedCategory) => {
          finalEntitiesMap.set(reorderedCategory._id.toString(), reorderedCategory)
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
        entitiesAfter: finalEntities,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: finalEntities.map(toServerCaseKeys<ICategory>),
      logId: log[0].id,
    }
  }

  public async editMany(
    data: CategoryEditDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategory[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session)
      )
    }
  }

  public async moveCategoriesToBoardBulk(
    data: (SingleUpdateDTO<Partial<ICategoryRaw>> & {
      board_id: Types.ObjectId
      board_name: string
    })[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoryRaw[]> {
    const newBoardIds = data.map((d) => d.board_id.toString() || '')
    const rawUpdates: SingleUpdateDTO<Partial<ICategoryRaw>>[] = []

    const boards = await this.boardService.getAll(
      {
        ids: newBoardIds,
      },
      userId,
      session
    )

    for (const dto of data) {
      const board = boards.find((b) => b.id.toString() === dto.board_id.toString())

      if (!board) throw new NotFoundError('Доска для перемещения не найдена.')

      rawUpdates.push({
        _id: dto._id,
        board_id: board.id,
        board_name: board.name,
        workspace_id: board.workspaceId,
        workspace_name: board.workspaceName,
      })
    }

    const updatedCategories = await this.repository.bulkUpdate(rawUpdates, userId, session)

    const categoriesMap: Map<
      string,
      {
        categoryName: string
        boardId: Types.ObjectId
        boardName: string
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    > = new Map()

    for (const category of updatedCategories) {
      categoriesMap.set(category._id.toString(), {
        categoryName: category.name,
        boardId: category.board_id,
        boardName: category.board_name,
        workspaceId: category.workspace_id,
        workspaceName: category.workspace_name,
      })
    }

    await this.taskService.moveTasksToBoardByCategoriesBulk(categoriesMap, userId, session)

    return updatedCategories
  }

  public async moveCategoriesToBoard(
    categoryIds: Types.ObjectId[],
    targets: {
      boardId: Types.ObjectId
      boardName: string
      workspaceId: Types.ObjectId
      workspaceName: string
    },
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoryRaw[]> {
    if (!targets) throw new NotFoundError('Доска для перемещения не найдена.')

    const filter = this.repository.buildFilter(
      { ids: categoryIds.map((id) => id.toString()) },
      userId
    )

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      {
        workspace_id: targets.workspaceId,
        workspace_name: targets.workspaceName,
        board_id: targets.boardId,
        board_name: targets.boardName,
      },
      session
    )

    await this.taskService.moveTasksToBoardByCategories(
      categoryIds,
      {
        boardId: targets.boardId,
        boardName: targets.boardName,
        workspaceId: targets.workspaceId,
        workspaceName: targets.workspaceName,
      },
      userId,
      session
    )

    return updatedCategories
  }

  public async moveCategoriesToWorkspaceByBoardsBulk(
    boardsMap: Map<
      string,
      {
        id: Types.ObjectId
        name: string
      }
    >,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filter = this.repository.buildFilter(
      { boardIds: Array.from(boardsMap.keys()).map((id) => id.toString()) },
      userId
    )

    const categoriesToUpdate = await this.repository.find(filter, session)

    const updates: SingleUpdateDTO<Partial<ICategoryRaw>>[] = []

    for (const category of categoriesToUpdate) {
      const newWorkspace = boardsMap.get(category.board_id.toString())

      if (newWorkspace) {
        updates.push({
          _id: category._id,
          workspace_id: newWorkspace.id,
          workspace_name: newWorkspace.name,
        })
      }
    }
    const updatedCategories = await this.repository.bulkUpdate(updates, userId, session)

    return updatedCategories.map((c) => toServerCaseKeys<ICategory>(c))
  }

  public async moveCategoriesToWorkspaceByBoards(
    boardIds: Types.ObjectId[],
    targetWorkspace: {
      id: Types.ObjectId
      name: string
    },
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )

    await this.repository.find(filter, session)

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { workspace_id: targetWorkspace.id, workspace_name: targetWorkspace.name },
      session
    )

    return updatedCategories.map((c) => toServerCaseKeys<ICategory>(c))
  }

  private async _executeDeleteTransaction(
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<ICategory[]> {
    let reorderedCategories: ICategoryRaw[] = []
    const filter = this.repository.buildFilter(criteria, userId)

    const categoriesToDelete = await this.repository.find(filter, session)

    if (categoriesToDelete.length === 0)
      throw new NotFoundError('Категории для удаления не найдены.')

    await this.repository.deleteMany(filter, session)

    await this.taskService.deleteTasksByCategories(
      categoriesToDelete.map((c) => c._id),
      userId,
      session
    )

    /* REORDER */
    reorderedCategories = await this.reorderService.reorderByParentIds(
      categoriesToDelete.map((c) => c.board_id),
      userId,
      session
    )

    return reorderedCategories.map((reorderedCategory) =>
      toServerCaseKeys<ICategory>(reorderedCategory)
    )
  }

  public async delete(
    criteria: CategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<ICategory[]> {
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
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoriesWithChildrenResponse>> {
    let reorderedCategories: ICategoryRaw[] = []

    const filter = this.repository.buildFilter(criteria, userId)

    const finalEntitiesMap = new Map<string, ICategoryRaw>()
    const categoriesToArchive = await this.repository.find(filter, session)

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, deleted_time: new Date() },
      session
    )

    /* REORDER */
    reorderedCategories = await this.reorderService.reorderByParentIds(
      categoriesToArchive.map((c) => c.board_id),
      userId,
      session
    )

    const archiveTasksResult = await this.taskService.archiveTasksByCategories(
      updatedCategories.map((c) => c._id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: updatedCategories.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    updatedCategories.forEach((uc) => {
      finalEntitiesMap.set(uc._id.toString(), uc)
    })

    reorderedCategories.forEach((reorderedCategory) => {
      finalEntitiesMap.set(reorderedCategory._id.toString(), reorderedCategory)
    })

    const finalObj = {
      categories: Array.from(finalEntitiesMap.values()).map((category) =>
        toServerCaseKeys<ICategory>(category)
      ),
      tasks: archiveTasksResult,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async archive(
    criteria: CategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoriesWithChildrenResponse>> {
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
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ICategoriesWithChildrenResponse>> {
    let reorderedCategories: ICategoryRaw[] = []

    const finalEntitiesMap = new Map<string, ICategoryRaw>()
    const filter = this.repository.buildFilter(criteria, userId)
    filter.is_deleted = true

    const categoriesToRecover = await this.repository.find(filter, session)

    if (categoriesToRecover.length === 0)
      throw new NotFoundError('Категории для восстановления не найдены.')

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, is_deleted_external: false, deleted_time: undefined },
      session
    )

    /* REORDER */
    reorderedCategories = await this.reorderService.reorderByParentIds(
      categoriesToRecover.map((c) => c.board_id),
      userId,
      session
    )

    const recoverTasksResult = await this.taskService.recoverTasksByCategories(
      updatedCategories.map((c) => c._id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.RECOVER,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: updatedCategories.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    updatedCategories.forEach((uc) => {
      finalEntitiesMap.set(uc._id.toString(), uc)
    })

    reorderedCategories.forEach((reorderedCategory) => {
      finalEntitiesMap.set(reorderedCategory._id.toString(), reorderedCategory)
    })

    const finalObj = {
      categories: Array.from(finalEntitiesMap.values()).map((category) =>
        toServerCaseKeys<ICategory>(category)
      ),
      tasks: recoverTasksResult,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async recover(
    criteria: CategoryCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ICategoriesWithChildrenResponse>> {
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
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ClonedCategoriesResult>> {
    const filter = this.repository.buildFilter(criteria, userId)

    const categoriesToClone = await this.repository.find(
      filter,
      session,
      '+embeddings -createdAt -updatedAt'
    )

    if (categoriesToClone.length === 0)
      throw new NotFoundError('Категории для клонирования не найдены.')

    const categoriesGroupedByBoard: Map<string, ICategoryRaw[]> = new Map()
    categoriesToClone.forEach((category) => {
      const boardId = category.board_id.toString()

      if (!categoriesGroupedByBoard.has(boardId)) {
        categoriesGroupedByBoard.set(boardId, [])
      }

      categoriesGroupedByBoard.get(boardId)!.push(category)
    })

    const transformedCategories: Omit<ICategoryRaw, '_id'>[] = []

    const boardIds = Array.from(categoriesGroupedByBoard.keys())

    const filterByBoards = this.repository.buildFilter({ boardIds }, userId)

    const existingCategoriesLite = await this.repository.find(
      filterByBoards,
      session,
      'board_id order'
    )

    for (const [boardId, categories] of categoriesGroupedByBoard) {
      const boardCategories = existingCategoriesLite.filter(
        (c) => c.board_id.toString() === boardId
      )

      let currentMaxOrder = boardCategories.reduce((max, t) => (t.order > max ? t.order : max), 0)

      for (const category of categories) {
        const cleanCategory = {
          ...category,
          _id: undefined,
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
        categoryName: string
        boardId: Types.ObjectId
        boardName: string
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    > = new Map()

    categoriesToClone.forEach((category, index) => {
      categoryIdsMap.set(category._id.toString(), {
        categoryId: newCategories[index]._id,
        categoryName: newCategories[index].name,
        boardId: newCategories[index].board_id,
        boardName: newCategories[index].board_name,
        workspaceId: newCategories[index].workspace_id,
        workspaceName: newCategories[index].workspace_name,
      })
    })

    const cloneTasksResult = await this.taskService.cloneTasksByCategories(
      categoryIdsMap,
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

    const finalObj = {
      categories: newCategories.map((cb) => toServerCaseKeys<ICategory>(cb)),
      tasks: cloneTasksResult,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async clone(
    criteria: CategoryCriteria,
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
      await this.delete({ ids: categoryAfterIds }, user, session)

      return {
        delete: { categories: entitiesAfter },
      }
    } else if (operationType === OperationTypesEnum.UPDATE) {
      const entitiesBeforeToEditSchema = entitiesBefore.map((e) => {
        return {
          ...toServerCaseKeys<ICategory>(e),
          id: e.id.toString(),
          boardId: e.boardId?.toString(),
          workspaceId: e.workspaceId?.toString(),
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
    } else throw new Error(`Операция ${operationType} не поддерживается для отката.`)
  }

  public async deleteCategoriesByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )

    await this.repository.deleteMany(filter, session)
  }

  public async archiveCategoriesByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoriesWithChildrenResponse> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()), isDeleted: false },
      userId
    )
    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, is_deleted_external: true },
      session
    )

    const archiveTasksResult = await this.taskService.archiveTasksByCategories(
      updatedCategories.map((category) => category._id),
      userId,
      session
    )

    return {
      categories: updatedCategories.map((c) => toServerCaseKeys<ICategory>(c)),
      tasks: archiveTasksResult,
    }
  }

  public async recoverCategoriesByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoriesWithChildrenResponse> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )
    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, is_deleted_external: false },
      session
    )

    const recoverTasks = await this.taskService.recoverTasksByCategories(
      updatedCategories.map((category) => category._id),
      userId,
      session
    )

    return {
      categories: updatedCategories.map((c) => toServerCaseKeys<ICategory>(c)),
      tasks: recoverTasks,
    }
  }

  public async cloneCategoriesByBoards(
    boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        boardName: string
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<ClonedCategoriesResult> {
    const boardIds = Array.from(boardIdsMap.keys())
    const filter = this.repository.buildFilter({ boardIds }, userId)
    const sourceCategories = await this.repository.find(filter, session)

    const cleanCategories = sourceCategories.map((category) => {
      const boardData = boardIdsMap.get(category.board_id.toString())

      if (!boardData) {
        throw new Error('Ошибка при клонировании категорий: не найдена целевая доска.')
      }

      return {
        ...category,
        board_id: boardData.boardId,
        board_name: boardData.boardName,
        workspace_id: boardData.workspaceId,
        workspace_name: boardData.workspaceName,
        _id: undefined,
      }
    })

    const clonedCategories = await this.repository.createMany(cleanCategories, session)

    const categoryIdsMap: Map<
      string,
      {
        categoryId: Types.ObjectId
        categoryName: string
        boardId: Types.ObjectId
        boardName: string
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    > = new Map()

    sourceCategories.forEach((category, index) => {
      categoryIdsMap.set(category._id.toString(), {
        categoryId: clonedCategories[index]._id,
        categoryName: clonedCategories[index].name,
        boardId: clonedCategories[index].board_id,
        boardName: clonedCategories[index].board_name,
        workspaceId: clonedCategories[index].workspace_id,
        workspaceName: clonedCategories[index].workspace_name,
      })
    })

    const tasksCloneResult = await this.taskService.cloneTasksByCategories(
      categoryIdsMap,
      userId,
      session
    )

    const clonedCategoriesTransformed = clonedCategories.map((cb) =>
      toServerCaseKeys<ICategory>(cb)
    )

    return {
      categories: clonedCategoriesTransformed,
      tasks: tasksCloneResult,
    }
  }

  public async updateCategoriesBoardName(
    boardIds: Types.ObjectId[],
    newName: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { board_name: newName },
      session
    )

    return updatedCategories.map((c) => toServerCaseKeys<ICategory>(c))
  }

  public async updateCategoriesWorkspaceName(
    workspaceIds: Types.ObjectId[],
    newName: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filter = this.repository.buildFilter(
      { workspaceIds: workspaceIds.map((id) => id.toString()) },
      userId
    )

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { workspace_name: newName },
      session
    )

    return updatedCategories.map((c) => toServerCaseKeys<ICategory>(c))
  }

  public async bulkUpdateCategoriesBoardNameByMap(
    boardMap: Map<
      string,
      {
        id: Types.ObjectId
        name: string
      }
    >,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filter = this.repository.buildFilter(
      { boardIds: Array.from(boardMap.keys()).map((id) => id.toString()) },
      userId
    )

    const categories = await this.repository.find(filter, session)

    const updates: SingleUpdateDTO<Partial<ICategoryRaw>>[] = []

    for (const category of categories) {
      const board = boardMap.get(category.board_id.toString())

      if (!board) continue

      updates.push({
        _id: category._id,
        board_name: board.name,
      })
    }

    const updatedCategories = await this.repository.bulkUpdate(updates, userId, session)

    return updatedCategories.map((c) => toServerCaseKeys<ICategory>(c))
  }

  public async bulkUpdateCategoriesWorkspaceNameByMap(
    workspaceMap: Map<
      string,
      {
        id: Types.ObjectId
        name: string
      }
    >,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filter = this.repository.buildFilter(
      { workspaceIds: Array.from(workspaceMap.keys()).map((id) => id.toString()) },
      userId
    )

    const categories = await this.repository.find(filter, session)

    const updates: SingleUpdateDTO<Partial<ICategoryRaw>>[] = []

    for (const category of categories) {
      const workspace = workspaceMap.get(category.workspace_id.toString())

      if (!workspace) continue

      updates.push({
        _id: category._id,
        workspace_name: workspace.name,
      })
    }

    const updatedCategories = await this.repository.bulkUpdate(updates, userId, session)

    return updatedCategories.map((c) => toServerCaseKeys<ICategory>(c))
  }

  private async prepareCategoryCreationPayload(
    data: CategoryDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const categoryName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(categoryName)

    const categoryPayload: Omit<ICategoryRaw, '_id'> = {
      ...toMongoCaseKeys(data),
      embeddings,
      user_id: userId,
    }

    if (data.order === undefined) {
      const lastOrder = await this.getLastOrder(data.boardId, userId, session)
      categoryPayload.order = lastOrder + 1
    }

    return categoryPayload
  }

  private async prepareCategoriesCreationPayload(
    data: CategoryDTO[],
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const categoriesPayloads: Omit<ICategoryRaw, '_id'>[] = []
    const categoriesGroupedByBoard: { [key: string]: CategoryDTO[] } = {}

    data.forEach((category) => {
      const boardId = category.boardId
      if (!categoriesGroupedByBoard[boardId]) {
        categoriesGroupedByBoard[boardId] = []
      }

      categoriesGroupedByBoard[boardId].push(category)
    })

    const grouppedCategoriesCount = await this.getLastOrderGrouppedByBoard(
      Object.keys(categoriesGroupedByBoard),
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
        (entry) => entry.board_id.toString() === boardId
      )
      let newOrder = existingCountEntry ? existingCountEntry.lastOrder : 0

      categories.forEach((category) => {
        if (category.order === undefined) {
          category.order = ++newOrder
        }
      })

      for (const category of categories) {
        const categoryName = category.name.trim()
        const categoryPayload: Omit<ICategoryRaw, '_id'> = {
          ...toMongoCaseKeys(category),
          embeddings: embeddingsMap[categoryName],
          user_id: userId,
        }
        categoriesPayloads.push(categoryPayload)
      }
    }

    return categoriesPayloads
  }

  private async prepareCategoryEditPayload(
    data: CategoryEditDTO,
    categoriesToUpdate: ICategoryRaw[]
  ) {
    const categoryPayload: SingleUpdateDTO<Partial<ICategoryRaw>> = {
      ...toMongoCaseKeys(data),
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

    if (typeof data.order === 'number') {
      categoryPayload.order = data.order
    } else if (typeof data.order === 'string') {
      categoryPayload.order = parseInt(data.order, 10)
    }

    return categoryPayload
  }

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory | null> {
    const category = await this.repository.findByIdAndUser(id, userId, session)

    return toServerCaseKeys(category)
  }

  public async getCount(
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter(criteria, userId)

    return await this.repository.getCount(filter, session)
  }

  public async getLastOrder(
    boardId: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter({ boardId }, userId)
    const existingCategoriesLite = await this.repository.find(filter, session, 'board_id order')

    let currentMaxOrder = existingCategoriesLite.reduce(
      (max, c) => (c.order > max ? c.order : max),
      0
    )

    return currentMaxOrder
  }

  public async getLastOrderGrouppedByBoard(
    boardIds: string[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ board_id: Types.ObjectId; lastOrder: number }[]> {
    const counts = []

    const uniqueBoardIds = Array.from(new Set(boardIds))

    const filterByBoards = this.repository.buildFilter({ boardIds: uniqueBoardIds }, userId)

    const existingCategoriesLite = await this.repository.find(
      filterByBoards,
      session,
      'board_id order'
    )

    for (const boardId of uniqueBoardIds) {
      const boardCategories = existingCategoriesLite.filter(
        (c) => c.board_id.toString() === boardId
      )
      let currentMaxOrder = boardCategories.reduce((max, c) => (c.order > max ? c.order : max), 0)

      counts.push({ board_id: new Types.ObjectId(boardId), lastOrder: currentMaxOrder })
    }

    return counts
  }

  public async getAll(
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const categories = await this.repository.find(filter, session)

    return categories.map((ws) => toServerCaseKeys(ws))
  }

  public async getByFilter(
    filter: FilterQuery<ICategoryRaw>,
    userId: Types.ObjectId,
    limit: number,
    session?: ClientSession
  ): Promise<ICategory[]> {
    const filterWithUser = { ...filter, user_id: userId }
    const categories = await this.repository.find(filterWithUser, session, null, limit)

    return categories.map((c) => toServerCaseKeys(c))
  }
}
