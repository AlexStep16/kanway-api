import { IBoard } from '@entities/IBoard.ts'
import { IBoardRaw } from '@entities/IBoardRaw.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import mongoose, { ClientSession, FilterQuery, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { BoardCriteria } from '@criterias/BoardCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { ClonedBoardsResult } from '@dtos/ClonedBoardsResult.ts'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.ts'
import { IUser } from '@entities/IUser.ts'
import { IBoardsWithChildrenResponse } from '@/application/interfaces/IBoardsWithChildrenResponse.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'

const MAX_RETRIES = 3

export class BoardService
  implements
    IBaseService<
      IBoard,
      BoardCriteria,
      BoardDTO,
      BoardEditDTO,
      ClonedBoardsResult,
      IBoardsWithChildrenResponse
    >
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
  ): Promise<IResponseWithLog<IBoard[]>> {
    let reorderedBoards: IBoardRaw[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
    const boardPayload = await this.prepareBoardCreationPayload(data, userId, session)

    /* CREATE */
    const newBoard = await this.repository.create(boardPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedBoards = await this.reorderService.reorder(
        'workspace_id',
        [newBoard],
        userId,
        session
      )
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: [newBoard],
        dependencies: [],
      },
      userId,
      session
    )

    finalEntitiesMap.set(newBoard._id.toString(), newBoard)

    if (reorderedBoards.length > 0) {
      reorderedBoards.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board)),
      logId: log[0].id,
    }
  }

  public async create(
    data: BoardDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
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
    data: BoardDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
    let reorderedBoards: IBoardRaw[] = []

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
        userId,
        session
      )
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: newBoards,
        dependencies: [],
      },
      userId,
      session
    )

    newBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    if (reorderedBoards.length > 0) {
      reorderedBoards.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board)),
      logId: log[0].id,
    }
  }

  public async createMany(
    data: BoardDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
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
    data: BoardEditDTO,
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
    let reorderedBoards: IBoardRaw[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const boardsToUpdate: IBoardRaw[] = await this.repository.find(filter, session)

    if (boardsToUpdate.length === 0) throw new NotFoundError('Доски для редактирования не найдены.')

    const boardPayload = await this.prepareBoardEditPayload(data, boardsToUpdate)
    const boardsBefore = projectProperties<IBoardRaw>(boardsToUpdate, boardPayload)

    /* UPDATE */
    const newEntities = await this.repository.updateByFilter(filter, boardPayload, session)
    const newEntity = newEntities[0]

    if (!newEntity) return { data: [], logId: null }

    /* MOVE */
    const boardsToMove = boardsToUpdate.filter(
      (b) => data.workspaceId !== undefined && b.workspace_id.toString() !== data.workspaceId
    )
    if (boardsToMove.length > 0) {
      await this.moveBoardsToWorkspace(
        boardsToMove.map((b) => b._id),
        {
          id: newEntity.workspace_id,
          name: newEntity.workspace_name,
        },
        userId,
        session
      )
    }

    /* REORDER */
    const boardsToReorder = boardsToUpdate.filter(
      (ws) => data.order !== undefined && ws.order !== data.order
    )
    if (boardsToReorder.length > 0) {
      reorderedBoards = await this.reorderService.reorder(
        'workspace_id',
        newEntities,
        userId,
        session
      )
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: newEntities,
        dependencies: [],
      },
      userId,
      session
    )

    newEntities.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    if (reorderedBoards.length > 0) {
      reorderedBoards.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board)),
      logId: log[0].id,
    }
  }

  public async edit(
    data: BoardEditDTO,
    criteria: BoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
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
    data: BoardEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
    let boardIdsToReorder: string[] = []
    let reorderedBoards: IBoardRaw[] = []
    let boardsPayloadToMove: SingleUpdateDTO<Partial<IBoardRaw>>[] = []

    const finalEntitiesMap = new Map<string, IBoardRaw>()
    const boardsToUpdate: SingleUpdateDTO<Partial<IBoardRaw>>[] = []
    const boardsBefore: Partial<IBoardRaw>[] = []

    const boardIds = data.map((d) => d.id)

    const filter = this.repository.buildFilter({ ids: boardIds }, userId)

    const existingBoards: IBoardRaw[] = await this.repository.find(filter, session)

    if (existingBoards.length === 0) throw new NotFoundError('Доски для обновления не найдены.')

    for (const dto of data) {
      const board = existingBoards.find((b) => b._id.toString() === dto.id)

      if (!board) continue

      const boardPayload = await this.prepareBoardEditPayload(dto, [board])
      boardsBefore.push(projectProperties<IBoardRaw>([board], boardPayload)[0])

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
      await this.moveBoardsToWorkspaceBulk(
        boardsPayloadToMove as (SingleUpdateDTO<Partial<IBoardRaw>> & {
          workspace_id: Types.ObjectId
          workspace_name: string
        })[],
        userId,
        session
      )
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
          userId,
          session
        )
      }
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    updatedBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    if (reorderedBoards.length > 0) {
      reorderedBoards.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board)),
      logId: log[0].id,
    }
  }

  public async editMany(
    data: BoardEditDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
    const userId = user.id

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
  ): Promise<void> {
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

    await this.repository.updateByFilter(
      { _id: { $in: data.map((d) => d._id) } },
      { order: 9999 },
      session
    )

    await this.categoryService.moveCategoriesToWorkspaceByBoardsBulk(boardsMap, userId, session)

    await this.taskService.moveTasksToWorkspaceByBoardsBulk(boardsMap, userId, session)
  }

  public async moveBoardsToWorkspace(
    boardIds: Types.ObjectId[],
    targetWorkspace: {
      id: Types.ObjectId
      name: string
    },
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    await this.repository.updateByFilter({ _id: { $in: boardIds } }, { order: 9999 }, session)

    await this.categoryService.moveCategoriesToWorkspaceByBoards(
      boardIds,
      {
        id: targetWorkspace.id,
        name: targetWorkspace.name,
      },
      userId,
      session
    )
    await this.taskService.moveTasksToWorkspaceByBoards(
      boardIds,
      {
        id: targetWorkspace.id,
        name: targetWorkspace.name,
      },
      userId,
      session
    )
  }

  private async _executeDeleteTransaction(
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoards: IBoardRaw[] = []

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
      userId,
      session
    )

    return [...reorderedBoards.map((rb) => toServerCaseKeys<IBoard>(rb))]
  }

  public async delete(
    criteria: BoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
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
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoardsWithChildrenResponse>> {
    let reorderedBoards: IBoardRaw[] = []

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
      userId,
      session
    )

    const archiveCategoriesResult = await this.categoryService.archiveCategoriesByBoards(
      updatedBoards.map((b) => b._id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: updatedBoards.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    updatedBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    reorderedBoards.forEach((reorderedBoard) => {
      finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
    })

    const finalObj = {
      boards: Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board)),
      categories: archiveCategoriesResult.categories,
      tasks: archiveCategoriesResult.tasks,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async archive(
    criteria: BoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardsWithChildrenResponse>> {
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
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoardsWithChildrenResponse>> {
    let reorderedBoards: IBoardRaw[] = []

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
      userId,
      session
    )

    const recoverCategoriesResult = await this.categoryService.recoverCategoriesByBoards(
      updatedBoards.map((b) => b._id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.RECOVER,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: updatedBoards.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    updatedBoards.forEach((board) => {
      finalEntitiesMap.set(board._id.toString(), board)
    })

    reorderedBoards.forEach((reorderedBoard) => {
      finalEntitiesMap.set(reorderedBoard._id.toString(), reorderedBoard)
    })

    const finalObj = {
      boards: Array.from(finalEntitiesMap.values()).map((board) => toServerCaseKeys<IBoard>(board)),
      categories: recoverCategoriesResult.categories,
      tasks: recoverCategoriesResult.tasks,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async recover(
    criteria: BoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardsWithChildrenResponse>> {
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
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ClonedBoardsResult>> {
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
        boardsGroupedByWorkspace.set(workspaceId, [])
      }

      boardsGroupedByWorkspace.get(workspaceId)!.push(board)
    })

    const transformedBoards: Omit<IBoardRaw, '_id'>[] = []

    const workspaceIds = Array.from(boardsGroupedByWorkspace.keys())

    const filterByWorkspaces = this.repository.buildFilter({ workspaceIds }, userId)

    const existingBoardsLite = await this.repository.find(
      filterByWorkspaces,
      session,
      'workspace_id order'
    )

    for (const [workspaceId, boards] of boardsGroupedByWorkspace) {
      const workspaceBoards = existingBoardsLite.filter(
        (b) => b.workspace_id.toString() === workspaceId
      )

      let currentMaxOrder = workspaceBoards.reduce((max, t) => (t.order > max ? t.order : max), 0)

      for (const board of boards) {
        const cleanBoard = {
          ...board,
          _id: undefined,
          order: ++currentMaxOrder,
        }

        transformedBoards.push(cleanBoard)
      }
    }

    const newBoards = await this.repository.createMany(transformedBoards, session)

    const boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        boardName: string
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    > = new Map()

    boardsToClone.forEach((board, index) => {
      boardIdsMap.set(board._id.toString(), {
        boardId: newBoards[index]._id,
        boardName: newBoards[index].name,
        workspaceId: newBoards[index].workspace_id,
        workspaceName: newBoards[index].workspace_name,
      })
    })

    const cloneCategoriesResult = await this.categoryService.cloneCategoriesByBoards(
      boardIdsMap,
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: newBoards,
        dependencies: [],
      },
      userId,
      session
    )

    await session.commitTransaction()

    const finalObj = {
      boards: newBoards.map((cb) => toServerCaseKeys<IBoard>(cb)),
      categories: cloneCategoriesResult.categories,
      tasks: cloneCategoriesResult.tasks,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async clone(
    criteria: BoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ClonedBoardsResult>> {
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
  ): Promise<IUndoResponse<Partial<IBoardsWithChildrenResponse>>> {
    const entitiesBefore = log.entitiesBefore as (Partial<IBoard> & { id: Types.ObjectId })[]
    const entitiesAfter = log.entitiesAfter as IBoard[]

    const boardBeforeIds = entitiesBefore.map((e) => e.id.toString())
    const boardAfterIds = entitiesAfter.map((e) => e.id.toString())
    const operationType = log.operationType

    if (operationType === OperationTypesEnum.CREATE) {
      await this.delete({ ids: boardAfterIds }, user, session)

      return {
        delete: { boards: entitiesAfter },
      }
    } else if (operationType === OperationTypesEnum.UPDATE) {
      const entitiesBeforeToEditSchema = entitiesBefore.map((e) => {
        return {
          ...toServerCaseKeys<IBoard>(e),
          id: e.id.toString(),
          workspaceId: e.workspaceId?.toString(),
        }
      })

      const editResult = await this.editMany(entitiesBeforeToEditSchema, user, session)

      return {
        update: { boards: editResult.data },
      }
    } else if (operationType === OperationTypesEnum.ARCHIVE) {
      const recoverResult = await this.recover({ ids: boardBeforeIds }, user, session)

      return {
        update: { boards: recoverResult.data.boards },
      }
    } else if (operationType === OperationTypesEnum.RECOVER) {
      const archiveResult = await this.archive({ ids: boardBeforeIds }, user, session)

      return {
        update: archiveResult.data,
      }
    } else throw new Error(`Операция ${operationType} не поддерживается для отката.`)
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
  ): Promise<IBoardsWithChildrenResponse> {
    const filter = this.repository.buildFilter(
      { workspaceIds: workspaceIds.map((id) => id.toString()), isDeleted: false },
      userId
    )
    const updatedBoards = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, is_deleted_external: true },
      session
    )

    const archiveCategoriesResult = await this.categoryService.archiveCategoriesByBoards(
      updatedBoards.map((board) => board._id),
      userId,
      session
    )

    return {
      boards: updatedBoards.map((wb) => toServerCaseKeys<IBoard>(wb)),
      categories: archiveCategoriesResult.categories,
      tasks: archiveCategoriesResult.tasks,
    }
  }

  public async recoverBoardsByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBoardsWithChildrenResponse> {
    const filter = this.repository.buildFilter(
      { workspaceIds: workspaceIds.map((id) => id.toString()) },
      userId
    )
    const updatedBoards = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, is_deleted_external: false },
      session
    )

    const recoverCategoriesResult = await this.categoryService.recoverCategoriesByBoards(
      updatedBoards.map((board) => board._id),
      userId,
      session
    )

    return {
      boards: updatedBoards.map((wb) => toServerCaseKeys<IBoard>(wb)),
      categories: recoverCategoriesResult.categories,
      tasks: recoverCategoriesResult.tasks,
    }
  }

  public async cloneBoardsByWorkspaces(
    workspaceIdsMap: Map<
      string,
      {
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<ClonedBoardsResult> {
    const workspaceIds = Array.from(workspaceIdsMap.keys())

    const filter = this.repository.buildFilter({ workspaceIds }, userId)

    const sourceBoards = await this.repository.find(filter, session)

    const cleanBoards = sourceBoards.map((board) => {
      const workpsaceData = workspaceIdsMap.get(board.workspace_id.toString())

      if (!workpsaceData) {
        throw new Error('Не удалось найти данные рабочего пространства для клонирования доски.')
      }

      return {
        ...board,
        workspace_id: workpsaceData.workspaceId,
        workspace_name: workpsaceData.workspaceName,
        _id: undefined,
      }
    })

    const clonedBoards = await this.repository.createMany(cleanBoards, session)

    const boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        boardName: string
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    > = new Map()

    sourceBoards.forEach((board, index) => {
      boardIdsMap.set(board._id.toString(), {
        boardId: clonedBoards[index]._id,
        boardName: clonedBoards[index].name,
        workspaceId: clonedBoards[index].workspace_id,
        workspaceName: clonedBoards[index].workspace_name,
      })
    })

    const categoriesCloneResult = await this.categoryService.cloneCategoriesByBoards(
      boardIdsMap,
      userId,
      session
    )

    const clonedBoardsTransformed = clonedBoards.map((cb) => toServerCaseKeys<IBoard>(cb))

    return {
      boards: clonedBoardsTransformed,
      categories: categoriesCloneResult.categories,
      tasks: categoriesCloneResult.tasks,
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
      const lastOrder = await this.getLastOrder(data.workspaceId, userId, session)
      boardPayload.order = lastOrder + 1
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

    const grouppedBoardsCount = await this.getLastOrderGrouppedByWorkspace(
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
      let newOrder = existingCountEntry ? existingCountEntry.lastOrder : 0

      boards.forEach((board) => {
        if (board.order === undefined) {
          board.order = ++newOrder
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

  private async prepareBoardEditPayload(data: BoardEditDTO, boardsToUpdate: IBoardRaw[]) {
    const boardPayload: SingleUpdateDTO<Partial<IBoardRaw>> = {
      ...toMongoCaseKeys(data),
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

    if (typeof data.order !== 'undefined') {
      boardPayload.order = typeof data.order === 'string' ? parseInt(data.order, 10) : data.order
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

    return await this.repository.getCount(filter, session)
  }

  public async getLastOrder(
    workspaceId: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter({ workspaceId }, userId)
    const existingBoardsLite = await this.repository.find(filter, session, 'workspace_id order')

    let currentMaxOrder = existingBoardsLite.reduce((max, b) => (b.order > max ? b.order : max), 0)

    return currentMaxOrder
  }

  public async getLastOrderGrouppedByWorkspace(
    workspaceIds: string[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ workspace_id: Types.ObjectId; lastOrder: number }[]> {
    const counts = []

    const uniqueWorkspaceIds = Array.from(new Set(workspaceIds))

    const filterByWorkspaces = this.repository.buildFilter(
      { workspaceIds: uniqueWorkspaceIds },
      userId
    )

    const existingBoardsLite = await this.repository.find(
      filterByWorkspaces,
      session,
      'workspace_id order'
    )

    for (const workspaceId of uniqueWorkspaceIds) {
      const workspaceBoards = existingBoardsLite.filter(
        (b) => b.workspace_id.toString() === workspaceId
      )

      let currentMaxOrder = workspaceBoards.reduce((max, b) => (b.order > max ? b.order : max), 0)

      counts.push({ workspace_id: new Types.ObjectId(workspaceId), lastOrder: currentMaxOrder })
    }

    return counts
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

  public async getByFilter(
    filter: FilterQuery<IBoardRaw>,
    userId: Types.ObjectId,
    limit: number,
    session?: ClientSession
  ): Promise<IBoard[]> {
    const filterWithUser = { ...filter, user_id: userId }
    const boards = await this.repository.find(filterWithUser, session, null, limit)

    return boards.map((b) => toServerCaseKeys(b))
  }
}
