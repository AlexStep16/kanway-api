import { ICategoryServerResponse } from '@entities/ICategoryServerResponse.ts'
import { ICategoryRaw } from '@entities/ICategoryRaw.ts'
import CategoryRepository from '@repositories/CategoryRepository.ts'
import { CategoryDTO } from '@application/dtos/CategoryDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { CategoryCriteria } from '@criterias/CategoryCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.ts'
import { ReorderResultDTO } from '@dtos/ReorderResultDTO.ts'
import { IOperationResult } from '@interfaces/IOperationResult.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { IMoveResult } from '../interfaces/IMoveResult.ts'
import { BoardService } from './BoardService.ts'

export class CategoryService
  implements IBaseService<ICategoryServerResponse, CategoryCriteria, CategoryDTO, CategoryEditDTO>
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

  public async create(
    data: CategoryDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategoryServerResponse[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []

    const tempClientId = data.id

    delete data.id // Remove temp client ID before creation

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const categoryPayload = await this.prepareCategoryCreationPayload(data, userId, session)

      /* CREATE */
      const newCategory = await this.repository.create(categoryPayload, session)

      /* REORDER */
      if (data.order !== undefined) {
        reorderedCategories = await this.reorderService.reorder(
          'board_id',
          [newCategory],
          CollectionsEnum.CATEGORIES,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedCategories.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesAfter: [newCategory],
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const toServerCaseCategory = toServerCaseKeys<ICategoryServerResponse>(newCategory)
      toServerCaseCategory.tempClientId = tempClientId // Attach temp client ID back to the response to connect with client-side entity

      if (reorderedCategories.length > 0) {
        const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()
        return [
          toServerCaseCategory,
          ...reorderedEntities.map((re) => toServerCaseKeys<ICategoryServerResponse>(re)),
        ]
      }

      return [toServerCaseCategory]
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
    data: CategoryDTO[],
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategoryServerResponse[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const categoriesPayload = await this.prepareCategoriesCreationPayload(data, userId, session)

      /* CREATE */
      const newCategories = await this.repository.createMany(categoriesPayload, session)

      /* REORDER */
      const isReorderNeeded = data.some((ws) => ws.order !== undefined)
      if (isReorderNeeded) {
        reorderedCategories = await this.reorderService.reorder(
          'board_id',
          newCategories,
          CollectionsEnum.CATEGORIES,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedCategories.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesAfter: newCategories,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const toServerCaseKeysCategories = newCategories.map((nc, index) => {
        const transformed = toServerCaseKeys<ICategoryServerResponse>(nc)

        transformed.tempClientId = data[index].id // Attach temp client ID back to the response to connect with client-side entity

        return transformed
      })

      if (reorderedCategories.length > 0) {
        const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()
        return [
          ...toServerCaseKeysCategories,
          ...reorderedEntities.map((re) => toServerCaseKeys<ICategoryServerResponse>(re)),
        ]
      }

      return [...toServerCaseKeysCategories]
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
    data: CategoryEditDTO,
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategoryServerResponse[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []
    let dependencies: Types.ObjectId[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const categoriesToUpdate: ICategoryRaw[] = await this.repository.find(filter, session)

      if (categoriesToUpdate.length === 0)
        throw new NotFoundError('Категории для редактирования не найдены.')

      const categoryPayload = await this.prepareCategoryEditPayload(
        data,
        categoriesToUpdate,
        userId
      )

      /* UPDATE */
      const newEntities = await this.repository.updateByFilter(filter, categoryPayload, session)

      /* MOVE */
      const categoriesToMove = categoriesToUpdate.filter(
        (b) => data.boardId !== undefined && b.board_id.toString() !== data.boardId
      )
      if (categoriesToMove.length > 0) {
        const moveResult = await this.moveCategoriesToBoard(
          categoriesToMove.map((c) => c._id),
          new Types.ObjectId(data.boardId),
          userId,
          newEntities,
          session
        )

        dependencies.push(...moveResult.logIds)
      }

      /* REORDER */
      const categoriesToReorder = categoriesToUpdate.filter(
        (ws) => data.order !== undefined && ws.order !== data.order
      )
      if (categoriesToReorder.length > 0) {
        reorderedCategories = await this.reorderService.reorder(
          'board_id',
          categoriesToReorder,
          CollectionsEnum.CATEGORIES,
          userId,
          session
        )
      }

      /* LOG */
      reorderedCategories.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesBefore: categoriesToUpdate,
          entitiesAfter: newEntities,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedCategories.length > 0) {
        const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()
        return [
          ...newEntities.map((ne) => toServerCaseKeys<ICategoryServerResponse>(ne)),
          ...reorderedEntities.map((re) => toServerCaseKeys<ICategoryServerResponse>(re)),
        ]
      }

      return [...newEntities.map((ne) => toServerCaseKeys<ICategoryServerResponse>(ne))]
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

  public async moveCategoriesToBoard(
    categoryIds: Types.ObjectId[],
    targetBoardId: Types.ObjectId,
    userId: Types.ObjectId,
    updatedCategoriesBefore: ICategoryRaw[],
    session?: ClientSession
  ): Promise<IMoveResult> {
    const newBoard = await this.boardService.getById(targetBoardId.toString(), userId, session)

    if (!newBoard) throw new NotFoundError('Доска для перемещения не найдена.')

    const filter = this.repository.buildFilter(
      { ids: categoryIds.map((id) => id.toString()) },
      userId
    )

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { workspace_id: newBoard.workspaceId },
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: updatedCategoriesBefore,
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    const tasksMoveResult = await this.taskService.moveTasksToBoardByCategories(
      categoryIds,
      targetBoardId,
      userId,
      session
    )

    return {
      logIds: [log[0].id, ...tasksMoveResult.logIds],
    }
  }

  public async moveCategoriesToWorkspaceByBoards(
    boardIds: Types.ObjectId[],
    targetWorkspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<ICategoryServerResponse>> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )

    const categoriesToUpdate = await this.repository.find(filter, session)

    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { workspace_id: targetWorkspaceId },
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: categoriesToUpdate,
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      entities: updatedCategories.map((c) => toServerCaseKeys<ICategoryServerResponse>(c)),
      logIds: [log[0].id],
    }
  }

  public async delete(
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategoryServerResponse[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

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
        CollectionsEnum.CATEGORIES,
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()

      return [...reorderedEntities.map((re) => toServerCaseKeys<ICategoryServerResponse>(re))]
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
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategoryServerResponse[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const categoriesToArchive = await this.repository.find(filter, session)

      const updatedCategories = await this.repository.updateByFilter(
        filter,
        { is_deleted: true },
        session
      )

      /* REORDER */
      reorderedCategories = await this.reorderService.reorderByParentIds(
        categoriesToArchive.map((c) => c.board_id),
        CollectionsEnum.CATEGORIES,
        userId,
        session
      )

      const archiveTasksResult = await this.taskService.archiveTasksByCategories(
        updatedCategories.map((c) => c._id),
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = archiveTasksResult.logIds

      reorderedCategories.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesBefore: updatedCategories.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedCategories,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()

      return [
        ...updatedCategories.map((ub) => toServerCaseKeys<ICategoryServerResponse>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<ICategoryServerResponse>(re)),
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
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategoryServerResponse[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const categoriesToRecover = await this.repository.find(filter, session)

      if (categoriesToRecover.length === 0)
        throw new NotFoundError('Категории для восстановления не найдены.')

      const updatedCategories = await this.repository.updateByFilter(
        filter,
        { is_deleted: false },
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      /* REORDER */
      reorderedCategories = await this.reorderService.reorderByParentIds(
        categoriesToRecover.map((c) => c.board_id),
        CollectionsEnum.CATEGORIES,
        userId,
        session
      )

      const recoverTasksResult = await this.taskService.recoverTasksByCategories(
        updatedCategories.map((c) => c._id),
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = recoverTasksResult.logIds

      reorderedCategories.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesBefore: updatedCategories.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedCategories,
          dependencies,
        },
        userId,
        session
      )

      const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()

      return [
        ...updatedCategories.map((ub) => toServerCaseKeys<ICategoryServerResponse>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<ICategoryServerResponse>(re)),
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

  public async clone(
    criteria: CategoryCriteria,
    userId: Types.ObjectId
  ): Promise<ICategoryServerResponse[]> {
    let session: ClientSession | null = null

    try {
      session = await mongoose.startSession()
      session.startTransaction()

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

      for (const [boardId, categories] of categoriesGroupedByBoard) {
        let newOrder = categoriesToClone.filter((t) => t.board_id.toString() === boardId).length + 1

        for (const category of categories) {
          const cleanCategory = {
            ...category,
            _id: undefined,
            order: newOrder,
          }

          newOrder += 1

          transformedCategories.push(cleanCategory)
        }
      }

      const newCategories = await this.repository.createMany(transformedCategories, session)

      const categoryIdsMap: Map<string, string> = new Map()
      categoriesToClone.forEach((sourceId, index) => {
        categoryIdsMap.set(sourceId.toString(), newCategories[index]._id.toString())
      })

      const cloneTasksResult = await this.taskService.cloneTasksByCategories(
        categoryIdsMap,
        userId,
        session
      )

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesAfter: newCategories,
          dependencies: cloneTasksResult.logIds,
        },
        userId,
        session
      )

      await session.commitTransaction()

      return newCategories.map((cb) => toServerCaseKeys<ICategoryServerResponse>(cb))
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
  ): Promise<IOperationResult<ICategoryServerResponse>> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )
    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, is_deleted_external: true },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: updatedCategories.map((c) => ({ ...c, is_deleted: false })),
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    const archiveTasksResult = await this.taskService.archiveTasksByCategories(
      updatedCategories.map((category) => category._id),
      userId,
      session
    )
    const combinedLogIds = log.map((l) => l.id).concat(archiveTasksResult.logIds)

    return {
      entities: updatedCategories.map((c) => toServerCaseKeys<ICategoryServerResponse>(c)),
      logIds: combinedLogIds,
    }
  }

  public async recoverCategoriesByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<ICategoryServerResponse>> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )
    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, is_deleted_external: false },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesBefore: updatedCategories.map((c) => ({ ...c, is_deleted: true })),
        entitiesAfter: updatedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    const recoverTasksResult = await this.taskService.recoverTasksByCategories(
      updatedCategories.map((category) => category._id),
      userId,
      session
    )
    const combinedLogIds = log.map((l) => l.id).concat(recoverTasksResult.logIds)

    return {
      entities: updatedCategories.map((c) => toServerCaseKeys<ICategoryServerResponse>(c)),
      logIds: combinedLogIds,
    }
  }

  public async cloneCategoriesByBoards(
    boardIdsMap: Map<string, string>,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IOperationResult<ICategoryServerResponse>> {
    const boardIds = Array.from(boardIdsMap.values())
    const filter = this.repository.buildFilter({ boardIds }, userId)
    const sourceCategories = await this.repository.find(filter, session)
    const sourceCategoriesIds = sourceCategories.map((category) => category._id)

    const cleanCategories = sourceCategories.map((category) => ({
      ...category,
      board_id: new Types.ObjectId(boardIdsMap.get(category.board_id.toString())),
      _id: undefined,
    }))

    const clonedCategories = await this.repository.createMany(cleanCategories, session)

    const categoryIdsMap: Map<string, string> = new Map()
    sourceCategoriesIds.forEach((sourceId, index) => {
      categoryIdsMap.set(sourceId.toString(), clonedCategories[index]._id.toString())
    })

    /* LOG */
    const logs = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.CATEGORIES,
        entitiesAfter: clonedCategories,
        dependencies: [],
      },
      userId,
      session
    )

    const tasksCloneResult = await this.taskService.cloneTasksByCategories(
      categoryIdsMap,
      userId,
      session
    )
    const combinedLogIds = logs.map((log) => log.id).concat(tasksCloneResult.logIds)

    const clonedCategoriesTransformed = clonedCategories.map((cb) =>
      toServerCaseKeys<ICategoryServerResponse>(cb)
    )

    return {
      entities: clonedCategoriesTransformed,
      logIds: combinedLogIds,
    }
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
      const allCategoriesCount = await this.getCount({ boardId: data.boardId }, userId, session)
      categoryPayload.order = allCategoriesCount + 1
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

    const grouppedCategoriesCount = await this.getCountGrouppedByBoards(
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
      let newOrder = existingCountEntry ? existingCountEntry.count : 0

      categories.forEach((category) => {
        if (category.order === undefined) {
          newOrder++
          category.order = newOrder
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
    categoriesToUpdate: ICategoryRaw[],
    userId: Types.ObjectId
  ) {
    const categoryPayload: Partial<ICategoryRaw> = {
      ...toMongoCaseKeys(data),
      user_id: userId,
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

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoryServerResponse | null> {
    const category = await this.repository.findByIdAndUser(id, userId, session)

    return toServerCaseKeys(category)
  }

  public async getCount(
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter(criteria, userId)

    return this.repository.getCount(filter, session)
  }

  public async getCountGrouppedByBoards(
    boardIds: string[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ board_id: Types.ObjectId; count: number }[]> {
    return this.repository.getCountGrouppedByBoards(
      boardIds.map((id) => new Types.ObjectId(id)),
      userId,
      session
    )
  }

  public async getAll(
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoryServerResponse[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const categories = await this.repository.find(filter, session)

    return categories.map((ws) => toServerCaseKeys(ws))
  }
}
