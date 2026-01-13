import { IBoard } from '@entities/IBoard.ts'
import { IBoardRaw } from '@entities/IBoardRaw.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { IBoardCriteria } from '@criterias/IBoardCriteria.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toMongoCaseKeys } from '@utils/objectTransformers.ts'
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
import { AppError } from '@/domain/errors/AppError.ts'
import { LifecycleDTO } from '../dtos/LifecycleDTO.ts'
import { WorkspaceService } from './WorkspaceService.ts'
import { BaseService } from './BaseService.ts'
import { IBoardPopulated } from '../interfaces/IBoardPopulated.ts'

const MAX_RETRIES = 3

export class BoardService extends BaseService<IBoardRaw, IBoard, IBoardCriteria, IBoardPopulated> {
  protected repository: BoardRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<IBoard, IBoardRaw>
  protected workspaceService: WorkspaceService
  protected categoryService: CategoryService
  protected taskService: TaskService

  constructor(
    boardRepository: BoardRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<IBoard, IBoardRaw>,
    workspaceService: WorkspaceService,
    categoryService: CategoryService,
    taskService: TaskService
  ) {
    super(boardRepository)

    this.repository = boardRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.workspaceService = workspaceService
    this.categoryService = categoryService
    this.taskService = taskService
  }

  protected getPopulateOptions() {
    return [{ path: 'workspace', select: 'name' }]
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
    data: BoardDTO,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
    let reorderedBoards: IBoard[] = []

    const finalEntitiesMap = new Map<string, IBoard>()
    const boardPayload = await this.prepareBoardCreationPayload(data, userId, session)

    /* CREATE */
    const newBoard = await this.repository.create(boardPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedBoards = await this.reorderService.reorder('workspace', [newBoard], userId, session)
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

    finalEntitiesMap.set(newBoard.id.toString(), newBoard)

    if (reorderedBoards.length > 0) {
      reorderedBoards.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard.id.toString(), reorderedBoard)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log.id,
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
    let reorderedBoards: IBoard[] = []

    const finalEntitiesMap = new Map<string, IBoard>()
    const boardsPayload = await this.prepareBoardsCreationPayload(data, userId, session)

    /* CREATE */
    const newBoards = await this.repository.createMany(boardsPayload, session)

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      reorderedBoards = await this.reorderService.reorder('workspace', newBoards, userId, session)
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
      finalEntitiesMap.set(board.id.toString(), board)
    })

    if (reorderedBoards.length > 0) {
      reorderedBoards.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard.id.toString(), reorderedBoard)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log.id,
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
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoard[]>> {
    let reorderedBoards: IBoard[] = []

    const finalEntitiesMap = new Map<string, IBoard>()

    const boardsToUpdate: IBoard[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId
    )

    if (boardsToUpdate.length === 0) throw new NotFoundError('Доски для редактирования не найдены.')

    const boardPayload = await this.prepareBoardEditPayload(data, boardsToUpdate)
    const boardsBefore = projectProperties<IBoard>(boardsToUpdate, boardPayload)

    /* UPDATE */
    const newEntities = await this.repository.updateManyByCriteria(
      criteria,
      boardPayload,
      session,
      userId
    )
    const newEntity = newEntities[0]

    if (!newEntity) return { data: [], logId: null }

    newEntities.forEach((board) => {
      finalEntitiesMap.set(board.id.toString(), board)
    })

    /* MOVE */
    const boardsToMove = boardsToUpdate.filter(
      (b) => data.workspaceId !== undefined && b.workspace.toString() !== data.workspaceId
    )
    if (boardsToMove.length > 0) {
    }

    /* REORDER */
    const boardsToReorder = boardsToUpdate.filter(
      (ws) => data.order !== undefined && ws.order !== data.order
    )

    const boardsToMoveToEnd = boardsToUpdate.filter(
      (b) => data.order == null && boardsToMove.includes(b)
    )

    for (const boardToMoveToEnd of boardsToMoveToEnd) {
      boardToMoveToEnd.order += 99999 // Move to end before reordering
    }

    if (boardsToReorder.length > 0) {
      reorderedBoards = await this.reorderService.reorder(
        'workspace',
        [...boardsToReorder, ...boardsToMoveToEnd],
        userId,
        session
      )

      reorderedBoards.forEach((reorderedBoard) => {
        finalEntitiesMap.set(reorderedBoard.id.toString(), reorderedBoard)
      })
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: finalEntities,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: finalEntities,
      logId: log.id,
    }
  }

  public async edit(
    data: BoardEditDTO,
    criteria: IBoardCriteria,
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
    const boardIdsToReorder: Set<string> = new Set()
    const boardIdsToMoveToEnd: Set<string> = new Set()
    const boardsPayloadToMove: SingleUpdateDTO<Partial<IBoard>>[] = []
    let reorderedBoards: IBoard[] = []

    const finalEntitiesMap = new Map<string, IBoard>()
    const boardsToUpdate: SingleUpdateDTO<Partial<IBoard>>[] = []
    const boardsBefore: Partial<IBoard>[] = []

    const boardIds = data.map((d) => d.id)

    const existingBoards: IBoard[] = await this.repository.findByCriteria(
      { ids: boardIds },
      session,
      undefined,
      userId
    )

    if (existingBoards.length === 0) throw new NotFoundError('Доски для обновления не найдены.')

    for (const dto of data) {
      const board = existingBoards.find((b) => b.id.toString() === dto.id)

      if (!board) continue

      const boardPayload = await this.prepareBoardEditPayload(dto, [board])
      boardsBefore.push(projectProperties<IBoard>([board], boardPayload)[0])

      boardsToUpdate.push(boardPayload)

      if (dto.workspaceId && board.workspace.toString() !== dto.workspaceId) {
        boardsPayloadToMove.push(boardPayload)
      }

      if (dto.order != null && board.order !== dto.order) {
        boardIdsToReorder.add(boardPayload._id.toString())
      } else if (dto.order == null && boardsPayloadToMove.includes(boardPayload)) {
        boardIdsToReorder.add(dto.id)
        boardIdsToMoveToEnd.add(dto.id)
      }
    }

    /* BULK UPDATE */
    const updatedBoards = await this.repository.bulkUpdate(boardsToUpdate, userId, session)

    updatedBoards.forEach((board) => {
      finalEntitiesMap.set(board.id.toString(), board)
    })

    /* MOVE */
    if (boardsPayloadToMove.length > 0) {
    }

    /* REORDER */
    if (boardIdsToReorder.size > 0) {
      for (const boardId of boardIdsToMoveToEnd) {
        const boardToMoveToEnd = updatedBoards.find((b) => b.id.toString() === boardId)

        if (boardToMoveToEnd) {
          boardToMoveToEnd.order += 99999 // Move to end before reordering
        }
      }

      const updatedBoardsToReorder = updatedBoards.filter((uc) =>
        boardIdsToReorder.has(uc.id.toString())
      )

      if (updatedBoardsToReorder.length > 0) {
        reorderedBoards = await this.reorderService.reorder(
          'workspace',
          updatedBoardsToReorder,
          userId,
          session
        )

        reorderedBoards.forEach((reorderedBoard) => {
          finalEntitiesMap.set(reorderedBoard.id.toString(), reorderedBoard)
        })
      }
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsBefore,
        entitiesAfter: finalEntities,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: finalEntities,
      logId: log.id,
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

  private async _executeDeleteTransaction(
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IBoard[]> {
    let reorderedBoard: IBoard[] = []
    const filter = this.repository.buildFilter(criteria, userId)

    const boardsToDelete = await this.repository.findByCriteria(filter, session, undefined, userId)

    if (boardsToDelete.length === 0) throw new NotFoundError('Доски для удаления не найдены.')

    await Promise.all([
      /* DELETE DEPENDENCIES */
      this.taskService.deleteTasksByFilter(
        { boardIds: boardsToDelete.map((b) => b.id.toString()) },
        userId,
        session
      ),
      this.categoryService.deleteCategoriesByFilter(
        { boardIds: boardsToDelete.map((b) => b.id.toString()) },
        userId,
        session
      ),

      /* DELETE BOARDS */
      this.repository.deleteMany(filter, userId, session),
    ])

    /* REORDER */
    reorderedBoard = await this.reorderService.reorderByParentIds(
      boardsToDelete.map((b) => b.workspace),
      'workspace',
      userId,
      session
    )

    return [...reorderedBoard]
  }

  public async delete(
    criteria: IBoardCriteria,
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

  private async _executeLifecycleTransaction(
    criteria: IBoardCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoardsWithChildrenResponse>> {
    let reorderedBoards: IBoard[] = []

    const finalEntitiesMap = new Map<string, IBoard>()
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
    const childrenData = { ...data, isDeletedExternal: isRecover ? false : true }

    const boardsToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId
    )

    const boardsCriteria = { boardIds: boardsToProcess.map((b) => b.id.toString()) }

    if (boardsToProcess.length === 0) throw new NotFoundError('Доски не найдены.')

    const result = await Promise.all([
      /* PROCESS CHILDREN */
      this.taskService.updateTasksByFilter(boardsCriteria, childrenData, userId, session),
      this.categoryService.updateCategoriesByFilter(boardsCriteria, childrenData, userId, session),

      /* PROCESS BOARDS */
      this.repository.updateManyByCriteria(criteria, data, session, userId),
    ])

    result[2].forEach((updatedBoard) => {
      finalEntitiesMap.set(updatedBoard.id.toString(), updatedBoard)
    })

    /* REORDER */
    reorderedBoards = await this.reorderService.reorderByParentIds(
      boardsToProcess.map((b) => b.workspace),
      'workspace',
      userId,
      session
    )

    reorderedBoards.forEach((reorderedBoard) => {
      finalEntitiesMap.set(reorderedBoard.id.toString(), reorderedBoard)
    })

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsToProcess,
        entitiesAfter: result[2],
        dependencies: [],
      },
      userId,
      session
    )

    const finalObj = {
      boards: Array.from(finalEntitiesMap.values()),
      tasks: result[0],
      categories: result[1],
    }

    return {
      data: finalObj,
      logId: log.id,
    }
  }

  public async archive(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardsWithChildrenResponse>> {
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
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardsWithChildrenResponse>> {
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
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ClonedBoardsResult>> {
    const filter = this.repository.buildFilter(criteria, userId)
    const dependencies: Types.ObjectId[] = []

    const boardsToClone = await this.repository.findByCriteria(
      filter,
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId
    )

    if (boardsToClone.length === 0) throw new NotFoundError('Доски для клонирования не найдены.')

    const boardsGroupedByWorkspace: Map<string, IBoard[]> = new Map()

    boardsToClone.forEach((board) => {
      const workspaceId = board.workspace.toString()

      if (!boardsGroupedByWorkspace.has(workspaceId)) {
        boardsGroupedByWorkspace.set(workspaceId, [])
      }

      boardsGroupedByWorkspace.get(workspaceId)!.push(board)
    })

    const transformedBoards: Omit<IBoard, 'id'>[] = []

    for (const [workspaceId, boards] of boardsGroupedByWorkspace) {
      const workspaceBoards = boardsToClone.filter((b) => b.workspace.toString() === workspaceId)

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
        workspaceId: Types.ObjectId
      }
    > = new Map()

    boardsToClone.forEach((board, index) => {
      boardIdsMap.set(board.id.toString(), {
        boardId: newBoards[index].id,
        workspaceId: newBoards[index].workspace,
      })
    })

    const cloneCategoriesResult = await this.categoryService.cloneCategoriesByBoards(
      boardIdsMap,
      userId,
      session
    )

    if (cloneCategoriesResult.logId) dependencies.push(cloneCategoriesResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: newBoards,
        dependencies,
      },
      userId,
      session
    )

    await session.commitTransaction()

    const finalObj = {
      boards: newBoards,
      categories: cloneCategoriesResult.data.categories,
      tasks: cloneCategoriesResult.data.tasks,
    }

    return {
      data: finalObj,
      logId: log.id,
    }
  }

  public async clone(
    criteria: IBoardCriteria,
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
          ...e,
          id: e.id.toString(),
          workspaceId: e.workspace?.toString(),
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
    } else throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
  }

  public async updateBoardsByFilter(
    criteria: IBoardCriteria,
    data: Partial<IBoard>,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBoard[]> {
    const updatedBoards = await this.repository.updateManyByCriteria(
      criteria,
      data,
      session,
      userId
    )

    return updatedBoards
  }

  public async deleteBoardsByFilter(
    criteria: IBoardCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const filter = this.repository.buildFilter(criteria, userId)

    await this.repository.deleteMany(filter, userId, session)
  }

  public async cloneBoardsByWorkspaces(
    workspaceIdsMap: Map<
      string,
      {
        workspaceId: Types.ObjectId
      }
    >,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ClonedBoardsResult>> {
    const workspaceIds = Array.from(workspaceIdsMap.keys())
    const dependencies: Types.ObjectId[] = []

    const filter = this.repository.buildFilter({ workspaceIds }, userId)

    const sourceBoards = await this.repository.findByCriteria(filter, session, undefined, userId)

    const cleanBoards = sourceBoards.map((board) => {
      const workpsaceData = workspaceIdsMap.get(board.workspace.toString())

      if (!workpsaceData) {
        throw new AppError(
          'Не удалось найти данные рабочего пространства для клонирования доски.',
          400
        )
      }

      return {
        ...board,
        workspace: workpsaceData.workspaceId,
        _id: undefined,
      }
    })

    const clonedBoards = await this.repository.createMany(cleanBoards, session)

    const boardIdsMap: Map<
      string,
      {
        boardId: Types.ObjectId
        workspaceId: Types.ObjectId
      }
    > = new Map()

    sourceBoards.forEach((board, index) => {
      boardIdsMap.set(board.id.toString(), {
        boardId: clonedBoards[index].id,
        workspaceId: clonedBoards[index].workspace,
      })
    })

    const categoriesCloneResult = await this.categoryService.cloneCategoriesByBoards(
      boardIdsMap,
      userId,
      session
    )

    if (categoriesCloneResult.logId) dependencies.push(categoriesCloneResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesAfter: clonedBoards,
        dependencies,
      },
      userId,
      session
    )

    return {
      data: {
        boards: clonedBoards,
        categories: categoriesCloneResult.data.categories,
        tasks: categoriesCloneResult.data.tasks,
      },
      logId: log.id,
    }
  }

  private async prepareBoardCreationPayload(
    data: BoardDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const boardName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(boardName)

    const boardPayload: Omit<IBoard, 'id'> = {
      ...toMongoCaseKeys(data),
      embeddings,
      userId,
    }

    if (data.order === undefined) {
      const lastOrder = await this.repository.getLastOrderGroupedByParents(
        [Types.ObjectId.createFromHexString(data.workspaceId)],
        'workspace',
        userId,
        session
      )
      boardPayload.order = lastOrder.length > 0 ? lastOrder[0].lastOrder + 1 : 1
    }

    return boardPayload
  }

  private async prepareBoardsCreationPayload(
    data: BoardDTO[],
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const boardsPayloads: Omit<IBoard, 'id'>[] = []
    const boardsGroupedByWorkspace: { [key: string]: BoardDTO[] } = {}

    data.forEach((board) => {
      const wsId = board.workspaceId
      if (!boardsGroupedByWorkspace[wsId]) {
        boardsGroupedByWorkspace[wsId] = []
      }

      boardsGroupedByWorkspace[wsId].push(board)
    })

    const grouppedBoardsCount = await this.repository.getLastOrderGroupedByParents(
      Object.keys(boardsGroupedByWorkspace).map((id) => Types.ObjectId.createFromHexString(id)),
      'workspace',
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
      const existingCountEntry = grouppedBoardsCount.find((entry) => entry._id.toString() === wsId)
      let newOrder = existingCountEntry ? existingCountEntry.lastOrder : 0

      boards.forEach((board) => {
        if (board.order === undefined) {
          board.order = ++newOrder
        }
      })

      for (const board of boards) {
        const boardName = board.name.trim()
        const boardPayload: Omit<IBoard, 'id'> = {
          ...toMongoCaseKeys(board),
          embeddings: embeddingsMap[boardName],
          userId,
        }
        boardsPayloads.push(boardPayload)
      }
    }

    return boardsPayloads
  }

  private async prepareBoardEditPayload(data: BoardEditDTO, boardsToUpdate: IBoard[]) {
    const boardPayload: SingleUpdateDTO<Partial<IBoard>> = {
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

  public async updateCounters(
    ids: Types.ObjectId[],
    delta: 1 | -1,
    field: keyof IBoardRaw,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    return await this.repository.increase(
      { ids: ids.map((id) => id.toString()) },
      delta,
      field,
      userId,
      session
    )
  }

  public async updateCountersBulk(
    updates: { ids: Types.ObjectId[]; delta: number; field: string }[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    return await this.repository.increaseBulk(updates, userId, session)
  }
}
