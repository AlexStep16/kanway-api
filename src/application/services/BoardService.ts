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
import { TaskService } from '@application/services/TaskService.ts'
import { IMoveResult } from '@interfaces/IMoveResult.ts'
import { ClonedBoardsResult } from '@dtos/ClonedBoardsResult.ts'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.ts'

const MAX_RETRIES = 3

export class BoardService
  implements IBaseService<IBoard, BoardCriteria, BoardDTO, BoardEditDTO, ClonedBoardsResult>
{
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
    data: BoardDTO,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
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

    finalEntitiesMap.set(newBoard._id.toString(), newBoard)

    if (reorderedBoards.length > 0) {
      const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

      reorderedEntities.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board))
  }

  public async create(
    data: BoardDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    if (externalSession) {
      return this._executeCreateTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, userId, session)
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: BoardDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
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

    newBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    if (reorderedBoards.length > 0) {
      const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

      reorderedEntities.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board))
  }

  public async createMany(
    data: BoardDTO[],
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    if (externalSession) {
      return this._executeCreateManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session)
      )
    }
  }

  private async _executeEditTransaction(
    data: BoardEditDTO,
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []
    let dependencies: Types.ObjectId[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const boardsToUpdate: IBoardRaw[] = await this.repository.find(filter, session)

    if (boardsToUpdate.length === 0) throw new NotFoundError('Доски для редактирования не найдены.')

    const boardPayload = await this.prepareBoardEditPayload(data, boardsToUpdate, userId)

    /* UPDATE */
    const newEntities = await this.repository.updateByFilter(filter, boardPayload, session)
    const newEntity = newEntities[0]

    if (!newEntity) return []

    /* MOVE */
    const boardsToMove = boardsToUpdate.filter(
      (b) => data.workspaceId !== undefined && b.workspace_id.toString() !== data.workspaceId
    )
    if (boardsToMove.length > 0) {
      const moveResult = await this.moveBoardsToWorkspace(
        boardsToMove.map((b) => b._id),
        {
          id: newEntity.workspace_id,
          name: newEntity.workspace_name,
        },
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
        newEntities,
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

    newEntities.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    if (reorderedBoards.length > 0) {
      const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

      reorderedEntities.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board))
  }

  public async edit(
    data: BoardEditDTO,
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session)
      )
    }
  }

  private async _executeEditManyTransaction(
    data: BoardEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ) {
    let boardIdsToReorder: string[] = []
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []
    let boardsPayloadToMove: SingleUpdateDTO<Partial<IBoardRaw>>[] = []
    let dependencies: Types.ObjectId[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
    const boardsToUpdate: SingleUpdateDTO<Partial<IBoardRaw>>[] = []

    const boardIds = data.map((d) => d.id)

    const filter = this.repository.buildFilter({ ids: boardIds }, userId)

    const existingBoards: IBoardRaw[] = await this.repository.find(filter, session)

    if (existingBoards.length === 0) throw new NotFoundError('Доски для обновления не найдены.')

    for (const dto of data) {
      const board = existingBoards.find((c) => c._id.toString() === dto.id)

      if (!board) continue

      const boardPayload = await this.prepareBoardEditPayload(dto, [board], userId)

      boardsToUpdate.push(boardPayload)

      if (dto.workspaceId && board.workspace_id.toString() !== dto.workspaceId) {
        boardsPayloadToMove.push(boardPayload)
      }

      if (dto.order != null && board.order !== dto.order) {
        boardIdsToReorder.push(boardPayload._id.toString())
      }
    }

    /* BULK UPDATE */
    const updatedBoards = await this.repository.bulkUpdate(boardsToUpdate, userId, session)

    /* MOVE */
    if (boardsPayloadToMove.length > 0) {
      const moveResult = await this.moveBoardsToWorkspaceBulk(
        boardsPayloadToMove as (SingleUpdateDTO<Partial<IBoardRaw>> & {
          workspace_id: Types.ObjectId
          workspace_name: string
        })[],
        userId,
        session
      )

      dependencies.push(...moveResult.logIds)
    }

    /* REORDER */
    if (boardIdsToReorder.length > 0) {
      const updatedBoardsToReorder = updatedBoards.filter((uc) =>
        boardIdsToReorder.includes(uc._id.toString())
      )

      if (updatedBoardsToReorder.length > 0) {
        reorderedBoards = await this.reorderService.reorder(
          'workspace_id',
          updatedBoardsToReorder,
          CollectionsEnum.BOARDS,
          userId,
          session
        )

        reorderedBoards.forEach((r) => {
          if (r.log) dependencies.push(r.log.id)
        })
      }
    }

    /* LOG */
    await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: existingBoards,
        entitiesAfter: updatedBoards,
        dependencies,
      },
      userId,
      session
    )

    updatedBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    if (reorderedBoards.length > 0) {
      const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

      reorderedEntities.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board))
  }

  public async editMany(
    data: BoardEditDTO[],
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ) {
    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session)
      )
    }
  }

  public async moveBoardsToWorkspaceBulk(
    data: (SingleUpdateDTO<Partial<IBoardRaw>> & {
      workspace_id: Types.ObjectId
      workspace_name: string
    })[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IMoveResult> {
    const boardsMap: Map<
      string,
      {
        id: Types.ObjectId
        name: string
      }
    > = new Map()

    for (const board of data) {
      boardsMap.set(board._id.toString(), {
        id: board.workspace_id,
        name: board.workspace_name,
      })
    }

    const categoriesMoveResult = await this.categoryService.moveCategoriesToWorkspaceByBoardsBulk(
      boardsMap,
      userId,
      session
    )

    const tasksMoveResult = await this.taskService.moveTasksToWorkspaceByBoardsBulk(
      boardsMap,
      userId,
      session
    )

    return {
      logIds: [...categoriesMoveResult.logIds, ...tasksMoveResult.logIds],
    }
  }

  public async moveBoardsToWorkspace(
    boardIds: Types.ObjectId[],
    targetWorkspace: {
      id: Types.ObjectId
      name: string
    },
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IMoveResult> {
    const categoriesMoveResult = await this.categoryService.moveCategoriesToWorkspaceByBoards(
      boardIds,
      {
        id: targetWorkspace.id,
        name: targetWorkspace.name,
      },
      userId,
      session
    )
    const tasksMoveResult = await this.taskService.moveTasksToWorkspaceByBoards(
      boardIds,
      {
        id: targetWorkspace.id,
        name: targetWorkspace.name,
      },
      userId,
      session
    )

    return {
      logIds: [...categoriesMoveResult.logIds, ...tasksMoveResult.logIds],
    }
  }

  private async _executeDeleteTransaction(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

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

    const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

    return [...reorderedEntities.map((re) => toServerCaseKeys<IBoard>(re))]
  }

  public async delete(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeArchiveTransaction(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const boardsToArchive = await this.repository.find(filter, session)

    if (boardsToArchive.length === 0) throw new NotFoundError('Доски для архивации не найдены.')

    const updatedBoards = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, deleted_time: new Date() },
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

    updatedBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

    reorderedEntities.forEach((reorderedBoard) => {
      finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
    })

    return Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board))
  }

  public async archive(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    if (externalSession) {
      return this._executeArchiveTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeArchiveTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeRecoverTransaction(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoards: ReorderResultDTO<IBoardRaw>[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const boardsToRecover = await this.repository.find(filter, session)

    if (boardsToRecover.length === 0)
      throw new NotFoundError('Доски для восстановления не найдены.')

    const updatedBoards = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, deleted_time: undefined },
      session
    )

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

    updatedBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    const reorderedEntities = reorderedBoards.map((r) => r.updatedEntities).flat()

    reorderedEntities.forEach((reorderedBoard) => {
      finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
    })

    return Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board))
  }

  public async recover(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    if (externalSession) {
      return this._executeRecoverTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeRecoverTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<ClonedBoardsResult> {
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
    boardsToClone.forEach((board, index) => {
      boardIdsMap.set(board._id.toString(), newBoards[index]._id.toString())
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

    return {
      boards: newBoards.map((cb) => toServerCaseKeys<IBoard>(cb)),
      categories: cloneCategoriesResult.entities.categories,
      tasks: cloneCategoriesResult.entities.tasks,
    }
  }

  public async clone(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<ClonedBoardsResult> {
    if (externalSession) {
      return this._executeCloneTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, userId, session)
      )
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
  ): Promise<IOperationResult<IBoard[]>> {
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
  ): Promise<IOperationResult<IBoard[]>> {
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
  ): Promise<IOperationResult<ClonedBoardsResult>> {
    const workspaceIds = Array.from(workspaceIdsMap.keys())

    const filter = this.repository.buildFilter({ workspaceIds }, userId)

    const sourceBoards = await this.repository.find(filter, session)

    const cleanBoards = sourceBoards.map((board) => ({
      ...board,
      workspace_id: new Types.ObjectId(workspaceIdsMap.get(board.workspace_id.toString())),
      _id: undefined,
    }))

    const clonedBoards = await this.repository.createMany(cleanBoards, session)

    const boardIdsMap: Map<string, string> = new Map()
    sourceBoards.forEach((board, index) => {
      boardIdsMap.set(board._id.toString(), clonedBoards[index]._id.toString())
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
      entities: {
        boards: clonedBoardsTransformed,
        categories: categoriesCloneResult.entities.categories,
        tasks: categoriesCloneResult.entities.tasks,
      },
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
    const boardPayload: SingleUpdateDTO<Partial<IBoardRaw>> = {
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

    if (typeof data.order === 'number') {
      boardPayload.order = data.order
    } else if (typeof data.order === 'string') {
      boardPayload.order = parseInt(data.order, 10)
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
