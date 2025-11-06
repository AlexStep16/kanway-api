import { IBoard } from '@entities/IBoard.ts'
import { IBoardRaw } from '@entities/IBoardRaw.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { BoardCriteria } from '@criterias/BoardCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { ReorderResultDTO } from '@dtos/ReorderResultDTO.ts'
import { IOperationResult } from '@interfaces/IOperationResult.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { TaskService } from './TaskService.ts'
import { IMoveResult } from '../interfaces/IMoveResult.ts'

export class BoardService implements IBaseService<IBoard, BoardCriteria, BoardDTO, BoardEditDTO> {
  protected repository: BoardRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<IBoardRaw>
  protected categoryService: CategoryService
  protected taskService: TaskService

  constructor(
    boardRepository: BoardRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<IBoardRaw>,
    categoryService: CategoryService,
    taskService: TaskService
  ) {
    this.repository = boardRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.categoryService = categoryService
    this.taskService = taskService
  }

  public async create(
    data: BoardDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const boardPayload = await this.prepareBoardCreationPayload(data, userId, session)

      /* CREATE */
      const newBoard = await this.repository.create(boardPayload, session)

      /* REORDER */
      if (data.order !== undefined) {
        reorderedBoards = await this.reorderService.reorder(
          'workspace_id',
          [newBoard],
          CollectionsEnum.BOARDS,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesAfter: [newBoard],
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedBoards.length > 0) {
        const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()
        return [
          toServerCaseKeys(newBoard),
          ...reorderedEntities.map((re) => toServerCaseKeys<IBoard>(re)),
        ]
      }

      return [toServerCaseKeys(newBoard)]
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
    data: BoardDTO[],
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const boardsPayload = await this.prepareBoardsCreationPayload(data, userId, session)

      /* CREATE */
      const newBoards = await this.repository.createMany(boardsPayload, session)

      /* REORDER */
      const isReorderNeeded = data.some((ws) => ws.order !== undefined)
      if (isReorderNeeded) {
        reorderedBoards = await this.reorderService.reorder(
          'workspace_id',
          newBoards,
          CollectionsEnum.BOARDS,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesAfter: newBoards,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedBoards.length > 0) {
        const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()
        return [
          ...newBoards.map((nb) => toServerCaseKeys<IBoard>(nb)),
          ...reorderedEntities.map((re) => toServerCaseKeys<IBoard>(re)),
        ]
      }

      return [...newBoards.map((nb) => toServerCaseKeys<IBoard>(nb))]
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
    data: BoardEditDTO,
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []
    let dependencies: Types.ObjectId[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const boardsToUpdate: IBoardRaw[] = await this.repository.find(filter, session)

      if (boardsToUpdate.length === 0)
        throw new NotFoundError('Доски для редактирования не найдены.')

      const boardPayload = await this.prepareBoardEditPayload(data, boardsToUpdate, userId)

      /* UPDATE */
      const newEntities = await this.repository.updateByFilter(filter, boardPayload, session)

      /* MOVE */
      const boardsToMove = boardsToUpdate.filter(
        (b) => data.workspaceId !== undefined && b.workspace_id.toString() !== data.workspaceId
      )
      if (boardsToMove.length > 0) {
        const moveResult = await this.moveBoardsToWorkspace(
          boardsToMove.map((b) => b._id),
          new Types.ObjectId(data.workspaceId),
          userId,
          session
        )

        dependencies.push(...moveResult.logIds)
      }

      /* REORDER */
      const boardsToReorder = boardsToUpdate.filter(
        (ws) => data.order !== undefined && ws.order !== data.order
      )
      if (boardsToReorder.length > 0) {
        reorderedBoards = await this.reorderService.reorder(
          'workspace_id',
          boardsToReorder,
          CollectionsEnum.BOARDS,
          userId,
          session
        )
      }

      /* LOG */
      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore: boardsToUpdate,
          entitiesAfter: newEntities,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedBoards.length > 0) {
        const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()
        return [
          ...newEntities.map((ne) => toServerCaseKeys<IBoard>(ne)),
          ...reorderedEntities.map((re) => toServerCaseKeys<IBoard>(re)),
        ]
      }

      return [...newEntities.map((ne) => toServerCaseKeys<IBoard>(ne))]
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

  public async moveBoardsToWorkspace(
    boardIds: Types.ObjectId[],
    targetWorkspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IMoveResult> {
    const categoriesMoveResult = await this.categoryService.moveCategoriesToWorkspaceByBoards(
      boardIds,
      targetWorkspaceId,
      userId,
      session
    )
    const tasksMoveResult = await this.taskService.moveTasksToWorkspaceByBoards(
      boardIds,
      targetWorkspaceId,
      userId,
      session
    )

    return {
      logIds: [...categoriesMoveResult.logIds, ...tasksMoveResult.logIds],
    }
  }

  public async delete(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const boardsToDelete = await this.repository.find(filter, session)

      if (boardsToDelete.length === 0) throw new NotFoundError('Доски для удаления не найдены.')

      await this.repository.deleteMany(filter, session)

      await this.categoryService.deleteCategoriesByBoards(
        boardsToDelete.map((b) => b._id),
        userId,
        session
      )

      /* REORDER */
      reorderedBoards = await this.reorderService.reorderByParentIds(
        boardsToDelete.map((b) => b.workspace_id),
        CollectionsEnum.BOARDS,
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

      return [...reorderedEntities.map((re) => toServerCaseKeys<IBoard>(re))]
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
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const boardsToArchive = await this.repository.find(filter, session)

      if (boardsToArchive.length === 0) throw new NotFoundError('Доски для архивации не найдены.')

      const updatedBoards = await this.repository.updateByFilter(
        filter,
        { is_deleted: true },
        session
      )

      /* REORDER */
      reorderedBoards = await this.reorderService.reorderByParentIds(
        boardsToArchive.map((b) => b.workspace_id),
        CollectionsEnum.BOARDS,
        userId,
        session
      )

      const archiveCategoriesResult = await this.categoryService.archiveCategoriesByBoards(
        updatedBoards.map((b) => b._id),
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = archiveCategoriesResult.logIds

      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore: updatedBoards.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedBoards,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

      return [
        ...updatedBoards.map((ub) => toServerCaseKeys<IBoard>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<IBoard>(re)),
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
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const boardsToRecover = await this.repository.find(filter, session)

      if (boardsToRecover.length === 0)
        throw new NotFoundError('Доски для восстановления не найдены.')

      const updatedBoards = await this.repository.updateByFilter(
        filter,
        { is_deleted: false },
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      /* REORDER */
      reorderedBoards = await this.reorderService.reorderByParentIds(
        boardsToRecover.map((b) => b.workspace_id),
        CollectionsEnum.BOARDS,
        userId,
        session
      )

      const recoverCategoriesResult = await this.categoryService.recoverCategoriesByBoards(
        updatedBoards.map((b) => b._id),
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = recoverCategoriesResult.logIds

      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore: updatedBoards.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedBoards,
          dependencies,
        },
        userId,
        session
      )

      const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

      return [
        ...updatedBoards.map((ub) => toServerCaseKeys<IBoard>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<IBoard>(re)),
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

  public async clone(criteria: BoardCriteria, userId: Types.ObjectId): Promise<IBoard[]> {
    let session: ClientSession | null = null

    try {
      session = await mongoose.startSession()
      session.startTransaction()

      const filter = this.repository.buildFilter(criteria, userId)

      const boardsToClone = await this.repository.find(
        filter,
        session,
        '+embeddings -createdAt -updatedAt'
      )

      if (boardsToClone.length === 0) throw new NotFoundError('Доски для клонирования не найдены.')

      const boardsGroupedByWorkspace: Map<string, IBoardRaw[]> = new Map()
      boardsToClone.forEach((board) => {
        const workspaceId = board.workspace_id.toString()
        if (!boardsGroupedByWorkspace.has(workspaceId)) {
          boardsGroupedByWorkspace.set(workspaceId, [board])
        }
        boardsGroupedByWorkspace.get(workspaceId)!.push(board)
      })

      const transformedBoards: Omit<IBoardRaw, '_id'>[] = []

      for (const [workspaceId, boards] of boardsGroupedByWorkspace) {
        let newOrder =
          boardsToClone.filter((t) => t.workspace_id.toString() === workspaceId).length + 1

        for (const board of boards) {
          const cleanBoard = {
            ...board,
            _id: undefined,
            order: newOrder,
          }

          newOrder += 1

          transformedBoards.push(cleanBoard)
        }
      }

      const newBoards = await this.repository.createMany(transformedBoards, session)

      const boardIdsMap: Map<string, string> = new Map()
      boardsToClone.forEach((sourceId, index) => {
        boardIdsMap.set(sourceId.toString(), newBoards[index]._id.toString())
      })

      const cloneCategoriesResult = await this.categoryService.cloneCategoriesByBoards(
        boardIdsMap,
        userId,
        session
      )

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesAfter: newBoards,
          dependencies: cloneCategoriesResult.logIds,
        },
        userId,
        session
      )

      await session.commitTransaction()

      return newBoards.map((cb) => toServerCaseKeys<IBoard>(cb))
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

  public async deleteBoardsByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const filter = this.repository.buildFilter(
      { workspaceIds: workspaceIds.map((id) => id.toString()) },
      userId
    )

    await this.repository.deleteMany(filter, session)
  }

  public async archiveBoardsByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<IBoard>> {
    const filter = this.repository.buildFilter(
      { workspaceIds: workspaceIds.map((id) => id.toString()) },
      userId
    )
    const updatedBoards = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, is_deleted_external: true },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: updatedBoards.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    const archiveCategoriesResult = await this.categoryService.archiveCategoriesByBoards(
      updatedBoards.map((board) => board._id),
      userId,
      session
    )
    const combinedLogIds = log.map((l) => l.id).concat(archiveCategoriesResult.logIds)

    return {
      entities: updatedBoards.map((wb) => toServerCaseKeys<IBoard>(wb)),
      logIds: combinedLogIds,
    }
  }

  public async recoverBoardsByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IOperationResult<IBoard>> {
    const filter = this.repository.buildFilter(
      { workspaceIds: workspaceIds.map((id) => id.toString()) },
      userId
    )
    const updatedBoards = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, is_deleted_external: false },
      session
    )

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: updatedBoards.map((ws) => ({ ...ws, is_deleted: true })),
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    const recoverCategoriesResult = await this.categoryService.recoverCategoriesByBoards(
      updatedBoards.map((board) => board._id),
      userId,
      session
    )
    const combinedLogIds = log.map((l) => l.id).concat(recoverCategoriesResult.logIds)

    return {
      entities: updatedBoards.map((wb) => toServerCaseKeys<IBoard>(wb)),
      logIds: combinedLogIds,
    }
  }

  public async cloneBoardsByWorkspaces(
    workspaceIdsMap: Map<string, string>,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IOperationResult<IBoard>> {
    const workspaceIds = Array.from(workspaceIdsMap.values())

    const filter = this.repository.buildFilter({ workspaceIds }, userId)

    const sourceBoards = await this.repository.find(filter, session)
    const sourceBoardIds = sourceBoards.map((board) => board._id)

    const cleanBoards = sourceBoards.map((board) => ({
      ...board,
      workspace_id: new Types.ObjectId(workspaceIdsMap.get(board.workspace_id.toString())),
      _id: undefined,
    }))

    const clonedBoards = await this.repository.createMany(cleanBoards, session)

    const boardIdsMap: Map<string, string> = new Map()
    sourceBoardIds.forEach((sourceId, index) => {
      boardIdsMap.set(sourceId.toString(), clonedBoards[index]._id.toString())
    })

    /* LOG */
    const logs = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: clonedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    const categoriesCloneResult = await this.categoryService.cloneCategoriesByBoards(
      boardIdsMap,
      userId,
      session
    )
    const combinedLogIds = logs.map((log) => log.id).concat(categoriesCloneResult.logIds)

    const clonedBoardsTransformed = clonedBoards.map((cb) => toServerCaseKeys<IBoard>(cb))

    return {
      entities: clonedBoardsTransformed,
      logIds: combinedLogIds,
    }
  }

  private async prepareBoardCreationPayload(
    data: BoardDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const boardName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(boardName)

    const boardPayload: Omit<IBoardRaw, '_id'> = {
      ...toMongoCaseKeys(data),
      embeddings,
      user_id: userId,
    }

    if (data.order === undefined) {
      const allBoardsCount = await this.getCount({ workspaceId: data.workspaceId }, userId, session)
      boardPayload.order = allBoardsCount + 1
    }

    return boardPayload
  }

  private async prepareBoardsCreationPayload(
    data: BoardDTO[],
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const boardsPayloads: Omit<IBoardRaw, '_id'>[] = []
    const boardsGroupedByWorkspace: { [key: string]: BoardDTO[] } = {}

    data.forEach((board) => {
      const wsId = board.workspaceId
      if (!boardsGroupedByWorkspace[wsId]) {
        boardsGroupedByWorkspace[wsId] = []
      }

      boardsGroupedByWorkspace[wsId].push(board)
    })

    const grouppedBoardsCount = await this.getCountGrouppedByWorkspaces(
      Object.keys(boardsGroupedByWorkspace),
      userId,
      session
    )

    const boardNames = Array.from(new Set(data.map((board) => board.name.trim())))
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(boardNames)
    const embeddingsMap: { [key: string]: number[] } = {}
    boardNames.forEach((name, index) => {
      embeddingsMap[name] = embeddingsArray[index]
    })

    for (const [wsId, boards] of Object.entries(boardsGroupedByWorkspace)) {
      const existingCountEntry = grouppedBoardsCount.find(
        (entry) => entry.workspace_id.toString() === wsId
      )
      let newOrder = existingCountEntry ? existingCountEntry.count : 0

      boards.forEach((board) => {
        if (board.order === undefined) {
          newOrder++
          board.order = newOrder
        }
      })

      for (const board of boards) {
        const boardName = board.name.trim()
        const boardPayload: Omit<IBoardRaw, '_id'> = {
          ...toMongoCaseKeys(board),
          embeddings: embeddingsMap[boardName],
          user_id: userId,
        }
        boardsPayloads.push(boardPayload)
      }
    }

    return boardsPayloads
  }

  private async prepareBoardEditPayload(
    data: BoardEditDTO,
    boardsToUpdate: IBoardRaw[],
    userId: Types.ObjectId
  ) {
    const boardPayload: Partial<IBoardRaw> = {
      ...toMongoCaseKeys(data),
      user_id: userId,
    }

    if (data.name && boardsToUpdate.length > 0) {
      const needEmbeddingsUpdate = boardsToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim()
      )

      const boardName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(boardName)

        boardPayload.embeddings = embeddings
      }
    }

    return boardPayload
  }

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBoard | null> {
    const board = await this.repository.findByIdAndUser(id, userId, session)

    return toServerCaseKeys(board)
  }

  public async getCount(
    criteria: BoardCriteria,
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
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBoard[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const boards = await this.repository.find(filter, session)

    return boards.map((ws) => toServerCaseKeys(ws))
  }
}
