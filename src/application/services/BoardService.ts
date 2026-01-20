import { IBoard } from '@entities/IBoard.ts'
import { IBoardRaw } from '@entities/IBoardRaw.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import mongoose, { ClientSession, Types, UpdateWriteOpResult } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { IBoardCriteria } from '@criterias/IBoardCriteria.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { SingleUpdateDTO } from '@dtos/SingleUpdateDTO.ts'
import { IUser } from '@entities/IUser.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { LifecycleDTO } from '../dtos/LifecycleDTO.ts'
import { WorkspaceService } from './WorkspaceService.ts'
import { BaseService } from './BaseService.ts'
import { IBoardPopulated } from '../interfaces/IBoardPopulated.ts'
import { IBoardCreatePayload } from '../interfaces/IBoardCreatePayload.ts'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.ts'

const MAX_RETRIES = 3

export class BoardService extends BaseService<
  IBoardRaw,
  IBoard,
  IBoardCriteria,
  IBoardPopulated,
  IBoardCreatePayload
> {
  protected repository: BoardRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<
    IBoard,
    IBoardRaw,
    IBoardCriteria,
    IBoardPopulated,
    IBoardCreatePayload
  >
  protected workspaceService: WorkspaceService
  protected categoryService: CategoryService
  protected taskService: TaskService

  constructor(
    boardRepository: BoardRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<
      IBoard,
      IBoardRaw,
      IBoardCriteria,
      IBoardPopulated,
      IBoardCreatePayload
    >,
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
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardPayload = await this.prepareBoardCreationPayload(data, userId, session)

    /* CREATE */
    const newBoard = await this.repository.create(boardPayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      await this.reorderService.reorder('workspace', [newBoard], userId, session)
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

    const newBoardsPopulated = await this.getByCriteria(
      { id: newBoard.id.toString() },
      userId,
      session
    )

    return {
      data: newBoardsPopulated,
      logId: log.id,
    }
  }

  public async create(
    data: BoardDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardsPayload = await this.prepareBoardsCreationPayload(data, userId, session)

    /* CREATE */
    const newBoards = await this.repository.createMany(boardsPayload, session)

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)
    if (isReorderNeeded) {
      await this.reorderService.reorder('workspace', newBoards, userId, session)
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

    const newBoardsPopulated = await this.getByCriteria(
      { ids: newBoards.map((b) => b.id.toString()) },
      userId,
      session
    )

    return {
      data: newBoardsPopulated,
      logId: log.id,
    }
  }

  public async createMany(
    data: BoardDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      boardPayload,
      session,
      userId
    )

    if (updateManyResult.modifiedCount === 0) throw new AppError('Не удалось обновить доски.', 500)

    const updatedBoards = await this.repository.findByCriteria<IBoard>(
      criteria,
      session,
      undefined,
      userId
    )

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
      await this.reorderService.reorder(
        'workspace',
        [...boardsToReorder, ...boardsToMoveToEnd],
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
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    const updatedBoardsPopulated = await this.getByCriteria(
      { ids: updatedBoards.map((b) => b.id.toString()) },
      userId,
      session
    )

    return {
      data: updatedBoardsPopulated,
      logId: log.id,
    }
  }

  public async edit(
    data: BoardEditDTO,
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    const boardIdsToReorder: Set<string> = new Set()
    const boardIdsToMoveToEnd: Set<string> = new Set()
    const boardPayloads: SingleUpdateDTO<SafeUpdateData<IBoard>>[] = []
    const boardPayloadsToMove: SingleUpdateDTO<SafeUpdateData<IBoard>>[] = []
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

      boardPayloads.push(boardPayload)

      if (dto.workspaceId && board.workspace.toString() !== dto.workspaceId) {
        boardPayloadsToMove.push(boardPayload)
      }

      if (dto.order != null && board.order !== dto.order) {
        boardIdsToReorder.add(boardPayload.id.toString())
      } else if (dto.order == null && boardPayloadsToMove.includes(boardPayload)) {
        boardIdsToReorder.add(dto.id)
        boardIdsToMoveToEnd.add(dto.id)
      }
    }

    /* BULK UPDATE */
    const updatedBoardsResult = await this.repository.bulkUpdate(boardPayloads, userId, session)

    if (!updatedBoardsResult || updatedBoardsResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить доски.', 500)

    const updatedBoards = await this.repository.findByCriteria(
      { ids: boardPayloads.map((t) => t.id.toString()) },
      session,
      undefined,
      userId
    )

    /* MOVE */
    if (boardPayloadsToMove.length > 0) {
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
        await this.reorderService.reorder('workspace', updatedBoardsToReorder, userId, session)
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

    const updatedBoardsPopulated = await this.getByCriteria(
      { ids: updatedBoards.map((b) => b.id.toString()) },
      userId,
      session
    )

    return {
      data: updatedBoardsPopulated,
      logId: log.id,
    }
  }

  public async editMany(
    data: BoardEditDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
  ): Promise<void> {
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
    await this.reorderService.reorderByParentIds(
      boardsToDelete.map((b) => b.workspace),
      'workspace',
      userId,
      session
    )
  }

  public async delete(
    criteria: IBoardCriteria,
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
    criteria: IBoardCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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

    await Promise.all([
      /* PROCESS CHILDREN */
      this.taskService.updateLifecycleTasksByFilter(boardsCriteria, childrenData, userId, session),
      this.categoryService.updateLifecycleCategoriesByFilter(
        boardsCriteria,
        childrenData,
        userId,
        session
      ),

      /* PROCESS BOARDS */
      this.repository.updateManyByCriteria(criteria, data, session, userId),
    ])

    const updatedBoards = await this.repository.findByCriteria<IBoard>(
      criteria,
      session,
      undefined,
      userId
    )

    /* REORDER */
    await this.reorderService.reorderByParentIds(
      boardsToProcess.map((b) => b.workspace),
      'workspace',
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.BOARDS,
        entitiesBefore: boardsToProcess,
        entitiesAfter: updatedBoards,
        dependencies: [],
      },
      userId,
      session
    )

    const updatedBoardsPopulated = await this.getByCriteria(
      { ids: updatedBoards.map((t) => t.id.toString()) },
      userId,
      session
    )

    return {
      data: updatedBoardsPopulated,
      logId: log.id,
    }
  }

  public async archive(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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
          id: undefined,
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

    const clonedBoardsPopulated = await this.getByCriteria(
      { ids: newBoards.map((b) => b.id.toString()) },
      userId,
      session
    )

    return {
      data: clonedBoardsPopulated,
      logId: log.id,
    }
  }

  public async clone(
    criteria: IBoardCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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

    const before = log.entitiesBefore as (Partial<IBoard> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<IBoard> & { id: Types.ObjectId })[]

    const idsBefore = before?.map((e) => e.id?.toString()) || []
    const idsAfter = after?.map((e) => e.id?.toString()) || []

    const workspaceIdsSet = new Set<string>()

    const collectWorkspaceIds = (items: IBoardPopulated[]) => {
      items.forEach((t) => {
        const wId = (t.workspace as any)?._id || (t.workspace as any)?.id || t.workspace
        if (wId) workspaceIdsSet.add(wId.toString())
      })
    }

    switch (operationType) {
      case OperationTypesEnum.CREATE: {
        await this.delete({ ids: idsAfter }, user, session)

        after.forEach((b) => {
          if (b.workspace) workspaceIdsSet.add(b.workspace.toString())
        })
        break
      }

      case OperationTypesEnum.UPDATE: {
        const payload = before.map((e) => ({
          ...e,
          id: e.id?.toString(),
        }))

        const result = await this.editMany(payload, user, session)
        collectWorkspaceIds(result.data)
        break
      }

      case OperationTypesEnum.ARCHIVE: {
        const result = await this.recover({ ids: idsBefore }, user, session)
        collectWorkspaceIds(result.data)
        break
      }

      case OperationTypesEnum.RECOVER: {
        const result = await this.archive({ ids: idsBefore }, user, session)
        collectWorkspaceIds(result.data)
        break
      }

      default:
        throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
    }

    return {
      affectedWorkspaceIds: Array.from(workspaceIdsSet),
    }
  }

  public async updateLifecycleBoardsByFilter(
    criteria: IBoardCriteria,
    data: SafeUpdateData<IBoard>,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<UpdateWriteOpResult> {
    await this.repository.findByCriteria(criteria, session, undefined, userId)

    // TODO: Update Counters

    return await this.repository.updateManyByCriteria(criteria, data, session, userId)
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
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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

    const clonedBoardsPopulated = await this.getByCriteria(
      { ids: clonedBoards.map((b) => b.id.toString()) },
      userId,
      session
    )

    return {
      data: clonedBoardsPopulated,
      logId: log.id,
    }
  }

  private async prepareBoardCreationPayload(
    data: BoardDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBoardCreatePayload> {
    const boardName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(boardName)

    const boardPayload: IBoardCreatePayload = {
      name: boardName,
      workspace: Types.ObjectId.createFromHexString(data.workspaceId),
      order: data.order || 1,
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
  ): Promise<IBoardCreatePayload[]> {
    const boardsPayloads: IBoardCreatePayload[] = []
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

    const countMap = new Map(
      grouppedBoardsCount.map((entry) => [entry._id.toString(), entry.lastOrder])
    )

    for (const [wsId, boards] of Object.entries(boardsGroupedByWorkspace)) {
      let currentOrder = countMap.get(wsId) || 1

      for (const board of boards) {
        const boardName = board.name.trim()

        const orderToSave = board.order ?? ++currentOrder

        boardsPayloads.push({
          name: boardName,
          workspace: new Types.ObjectId(board.workspaceId),
          order: orderToSave,
          embeddings: embeddingsMap[boardName],
          userId,
        })
      }
    }

    return boardsPayloads
  }

  private async prepareBoardEditPayload(
    data: BoardEditDTO,
    boardsToUpdate: IBoard[]
  ): Promise<SingleUpdateDTO<SafeUpdateData<IBoard>>> {
    const { id, workspaceId, ...rest } = data

    const boardPayload: SingleUpdateDTO<SafeUpdateData<IBoard>> = {
      ...rest,

      id: new Types.ObjectId(id),
      workspace: workspaceId ? new Types.ObjectId(workspaceId) : undefined,
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
}
