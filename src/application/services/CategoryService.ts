import { ICategory } from '@entities/ICategory.ts'
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
import { ReorderResultDTO } from '../dtos/ReorderResultDTO.ts'
import { IOperationResult } from '../interfaces/IOperationResult.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'

export class CategoryService
  implements IBaseService<ICategory, CategoryCriteria, CategoryDTO, CategoryEditDTO>
{
  protected repository: CategoryRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<ICategoryRaw>

  constructor(
    categoryRepository: CategoryRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<ICategoryRaw>
  ) {
    this.repository = categoryRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
  }

  public async create(
    data: CategoryDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategory[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const categoryPayload = await this.prepareCategoryCreationPayload(data, userId)

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

      if (reorderedCategories.length > 0) {
        const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()
        return [
          toServerCaseKeys(newCategory),
          ...reorderedEntities.map((re) => toServerCaseKeys<ICategory>(re)),
        ]
      }

      return [toServerCaseKeys(newCategory)]
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
  ): Promise<ICategory[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedCategories: ReorderResultDTO<ICategoryRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const categoriesPayload = await this.prepareCategoriesCreationPayload(data, userId)

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

      if (reorderedCategories.length > 0) {
        const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()
        return [
          ...newCategories.map((nb) => toServerCaseKeys<ICategory>(nb)),
          ...reorderedEntities.map((re) => toServerCaseKeys<ICategory>(re)),
        ]
      }

      return [...newCategories.map((nb) => toServerCaseKeys<ICategory>(nb))]
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
  ): Promise<ICategory[]> {
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

      const categoriesToUpdate: ICategoryRaw[] = await this.repository.find(filter, session)

      const categoryPayload = await this.prepareCategoryEditPayload(
        data,
        categoriesToUpdate,
        userId
      )

      /* UPDATE */
      const newEntities = await this.repository.updateByFilter(filter, categoryPayload, session)

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
      let dependencies: Types.ObjectId[] = []

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
          ...newEntities.map((ne) => toServerCaseKeys<ICategory>(ne)),
          ...reorderedEntities.map((re) => toServerCaseKeys<ICategory>(re)),
        ]
      }

      return [...newEntities.map((ne) => toServerCaseKeys<ICategory>(ne))]
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

  public async delete(
    criteria: CategoryCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ICategory[]> {
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

      await this.repository.deleteMany(filter, session)

      /* REORDER */
      reorderedCategories = await this.reorderService.reorderByParentIds(
        [userId],
        CollectionsEnum.CATEGORIES,
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedCategories.map((r) => r.updatedEntities).flat()

      return [...reorderedEntities.map((re) => toServerCaseKeys<ICategory>(re))]
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
  ): Promise<ICategory[]> {
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

      const updatedCategories = await this.repository.updateByFilter(
        filter,
        { is_deleted: true },
        session
      )

      /* REORDER */
      reorderedCategories = await this.reorderService.reorderByParentIds(
        [userId],
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
        ...updatedCategories.map((ub) => toServerCaseKeys<ICategory>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<ICategory>(re)),
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
  ): Promise<ICategory[]> {
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
        [userId],
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
        ...updatedCategories.map((ub) => toServerCaseKeys<ICategory>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<ICategory>(re)),
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

  public async clone(id: string, userId: Types.ObjectId): Promise<ICategory> {
    let session: ClientSession | null = null

    try {
      session = await mongoose.startSession()
      session.startTransaction()

      const sourceCategory = await this.repository.findByIdAndUser(id, userId)

      if (!sourceCategory) throw new NotFoundError('Исходная категория не найдена.')

      const allCategories = await this.repository.find(
        { board_id: sourceCategory.board_id },
        session
      )

      const cleanCategory = {
        ...sourceCategory,
        _id: undefined,
        order: allCategories.length + 1,
        name: `${sourceCategory?.name} - Копия`,
      }

      const newCategory = await this.repository.create(cleanCategory, session)

      const cloneTasksResult = await this.taskService.cloneTasksByCategory(
        sourceCategory._id,
        newCategory._id,
        userId,
        session
      )

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.CATEGORIES,
          entitiesAfter: [newCategory],
          dependencies: cloneTasksResult.logIds,
        },
        userId,
        session
      )

      await session.commitTransaction()

      return toServerCaseKeys<ICategory>(newCategory)
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

  public async archiveCategoriesByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<ICategory>> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )
    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: true },
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
      entities: updatedCategories.map((c) => toServerCaseKeys<ICategory>(c)),
      logIds: combinedLogIds,
    }
  }

  public async recoverCategoriesByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<ICategory>> {
    const filter = this.repository.buildFilter(
      { boardIds: boardIds.map((id) => id.toString()) },
      userId
    )
    const updatedCategories = await this.repository.updateByFilter(
      filter,
      { is_deleted: false },
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
      entities: updatedCategories.map((c) => toServerCaseKeys<ICategory>(c)),
      logIds: combinedLogIds,
    }
  }

  public async cloneCategoriesByBoard(
    sourceCategoryId: Types.ObjectId,
    targetBoardId: Types.ObjectId,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IOperationResult<ICategory>> {
    const filter = this.repository.buildFilter({ boardId: sourceCategoryId.toString() }, userId)
    const sourceCategories = await this.repository.find(filter, session)
    const sourceCategoriesIds = sourceCategories.map((category) => category._id)

    const cleanCategories = sourceCategories.map((category) => ({
      ...category,
      board_id: targetBoardId,
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
      toServerCaseKeys<ICategory>(cb)
    )

    return {
      entities: clonedCategoriesTransformed,
      logIds: combinedLogIds,
    }
  }

  public async cloneCategoriesByBoards(
    boardIdsMap: Map<string, string>,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IOperationResult<ICategory>> {
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

    const categoryIdsMap: { [key: string]: Types.ObjectId } = {}
    sourceCategoriesIds.forEach((sourceId, index) => {
      categoryIdsMap[sourceId.toString()] = clonedCategories[index]._id
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

    /*const categoriesCloneResult = await this.categoryService.cloneCategoriesByCategories(
      categoryIdMap,
      userId,
      session
    )
    const combinedLogIds = logs.map((log) => log.id).concat(categoriesCloneResult.logIds)*/

    const clonedCategoriesTransformed = clonedCategories.map((cb) =>
      toServerCaseKeys<ICategory>(cb)
    )

    return {
      entities: clonedCategoriesTransformed,
      logIds: /*combinedLogIds*/ logs.map((log) => log.id),
    }
  }

  private async prepareCategoryCreationPayload(data: CategoryDTO, userId: Types.ObjectId) {
    const categoryName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(categoryName)

    const categoryPayload: Omit<ICategoryRaw, '_id'> = {
      ...toMongoCaseKeys(data),
      embeddings,
      user_id: userId,
    }

    if (data.order === undefined) {
      const allCategoriesCount = await this.getCount({ boardId: data.boardId }, userId)
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
    const categoriesGroupedByWorkspace: { [key: string]: CategoryDTO[] } = {}

    data.forEach((category) => {
      const wsId = category.boardId
      if (!categoriesGroupedByWorkspace[wsId]) {
        categoriesGroupedByWorkspace[wsId] = []
      }

      categoriesGroupedByWorkspace[wsId].push(category)
    })

    const grouppedCategoriesCount = await this.getCountGrouppedByWorkspaces(
      Object.keys(categoriesGroupedByWorkspace),
      userId,
      session
    )

    const categoryNames = Array.from(new Set(data.map((category) => category.name.trim())))
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(categoryNames)
    const embeddingsMap: { [key: string]: number[] } = {}
    categoryNames.forEach((name, index) => {
      embeddingsMap[name] = embeddingsArray[index]
    })

    for (const [wsId, categories] of Object.entries(categoriesGroupedByWorkspace)) {
      const existingCountEntry = grouppedCategoriesCount.find(
        (entry) => entry.workspace_id.toString() === wsId
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

    return this.repository.getCount(filter, session)
  }

  public async getCountGrouppedByWorkspaces(
    workspaceIds: string[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ workspace_id: Types.ObjectId; count: number }[]> {
    return this.repository.getCountGrouppedByWorkspaces(
      workspaceIds.map((id) => new Types.ObjectId(id)),
      userId,
      session
    )
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
}
