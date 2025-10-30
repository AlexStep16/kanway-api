import { IBoard } from '@entities/IBoard.ts'
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
import { ReorderResultDTO } from '../dtos/ReorderResultDTO.ts'

export class BoardService implements IBaseService<IBoard, BoardCriteria, BoardDTO> {
  protected repository: BoardRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<IBoard>

  constructor(
    boardRepository: BoardRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<IBoard>
  ) {
    this.repository = boardRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
  }

  public async create(
    data: BoardDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoard>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const boardPayload = await this.prepareBoardCreationPayload(data, userId)

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
        if (r.log) dependencies.push(r.log._id)
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
        return [newBoard, ...reorderedBoards.map((r) => r.updatedEntities).flat()]
      }

      return [newBoard]
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
    let reorderedBoards: ReorderResultDTO<IBoard>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const boardsPayload = await this.prepareBoardsCreationPayload(data, userId)

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
        if (r.log) dependencies.push(r.log._id)
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
        return [...newBoards, ...reorderedBoards.map((r) => r.updatedEntities).flat()]
      }

      return newBoards
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
    let reorderedBoards: ReorderResultDTO<IBoard>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const boardsToUpdate: IBoard[] = await this.repository.find(filter, session)

      const boardPayload = await this.prepareBoardEditPayload(data, boardsToUpdate, userId)

      /* UPDATE */
      const newEntities = await this.repository.updateByFilter(filter, boardPayload, session)

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
      let dependencies: Types.ObjectId[] = []

      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log._id)
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
        return [...newEntities, ...reorderedBoards.map((r) => r.updatedEntities).flat()]
      }

      return newEntities
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
    criteria: BoardCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IBoard[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedBoards: ReorderResultDTO<IBoard>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      await this.repository.deleteMany(filter, session)

      /* REORDER */
      reorderedBoards = await this.reorderService.reorderByParentIds(
        [userId],
        CollectionsEnum.BOARDS,
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      return [...reorderedBoards.map((r) => r.updatedEntities).flat()]
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
    let reorderedBoards: ReorderResultDTO<IBoard>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const updatedBoards = await this.repository.updateByFilter(
        filter,
        { is_deleted: true },
        session
      )

      /* REORDER */
      reorderedBoards = await this.reorderService.reorderByParentIds(
        [userId],
        CollectionsEnum.BOARDS,
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log._id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
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

      return [...updatedBoards, ...reorderedBoards.map((r) => r.updatedEntities).flat()]
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
    let reorderedBoards: ReorderResultDTO<IBoard>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

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
        [userId],
        CollectionsEnum.BOARDS,
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedBoards.forEach((r) => {
        if (r.log) dependencies.push(r.log._id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.BOARDS,
          entitiesBefore: updatedBoards.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedBoards,
          dependencies,
        },
        userId,
        session
      )

      return [...updatedBoards, ...reorderedBoards.map((r) => r.updatedEntities).flat()]
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

  private async prepareBoardCreationPayload(data: BoardDTO, userId: Types.ObjectId) {
    const allBoardsCount = await this.getCount({}, userId)
    let newOrder = allBoardsCount + 1

    const boardName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(boardName)

    const boardPayload: Partial<IBoard> = {
      ...toMongoCaseKeys(data),
      order: newOrder,
      embeddings,
      user_id: userId,
    }

    return boardPayload
  }

  private async prepareBoardsCreationPayload(data: BoardDTO[], userId: Types.ObjectId) {
    const allBoardsCount = await this.getCount({}, userId)
    let newOrder = allBoardsCount + 1

    const boardNames = data.map((board) => board.name.trim())
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(boardNames)

    const boardPayloads: Partial<IBoard>[] = data.map((board, index) => ({
      ...toMongoCaseKeys(board),
      order: newOrder++,
      embeddings: embeddingsArray[index],
      user_id: userId,
    }))

    return boardPayloads
  }

  private async prepareBoardEditPayload(
    data: BoardEditDTO,
    boardsToUpdate: IBoard[],
    userId: Types.ObjectId
  ) {
    const boardPayload: Partial<IBoard> = {
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

  public async getById(id: string, userId: Types.ObjectId): Promise<IBoard | null> {
    const board = await this.repository.findByIdAndUser(id, userId)

    return toServerCaseKeys(board)
  }

  public async getCount(criteria: BoardCriteria, userId: Types.ObjectId): Promise<number> {
    const filter = this.repository.buildFilter(criteria, userId)

    return this.repository.getCount(filter)
  }

  public async getAll(criteria: BoardCriteria, userId: Types.ObjectId): Promise<IBoard[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const boards = await this.repository.find(filter)

    return boards.map((ws) => toServerCaseKeys(ws))
  }
}
