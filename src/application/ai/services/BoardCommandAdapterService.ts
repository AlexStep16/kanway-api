import { BoardService } from '@application/services/BoardService.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'
import { StringModificationDTO } from '../tools/schemes/baseSchemes.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'

export class BoardCommandAdapterService {
  protected boardService: BoardService
  protected workspaceService: WorkspaceService
  protected vectorSearchService: VectorSearchService
  protected aiSemanticService: AISemanticService

  constructor(
    boardService: BoardService,
    workspaceService: WorkspaceService,
    vectorSearchService: VectorSearchService,
    aiSemanticService: AISemanticService,
  ) {
    this.boardService = boardService
    this.workspaceService = workspaceService
    this.vectorSearchService = vectorSearchService
    this.aiSemanticService = aiSemanticService
  }
  private _getTransformedBoardsForStringModification(
    boards: IBoardPopulated[],
    field: 'name',
  ): { id: Types.ObjectId; text: string }[] {
    return boards.map((board) => ({
      id: board.id,
      text: board[field] || '',
    }))
  }

  public async translateEditStringAndExecute(
    boardIds: string[],
    dto: StringModificationDTO,
    field: 'name',
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (typeof dto === 'undefined' || dto === null || Object.keys(dto).length === 0) {
      return {
        data: [],
        logId: null,
      }
    }

    const boardsToUpdate: BoardEditDTO[] = []

    const existingBoards = await this.boardService.getByCriteria(
      { ids: boardIds },
      user.id,
      session,
    )
    const transformedBoards = this._getTransformedBoardsForStringModification(existingBoards, field)

    let updatedTexts: { id: Types.ObjectId; text: string }[] = []

    if (dto.set) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        transformedBoards,
        String(dto.set),
        'set',
      )
    }
    if (dto.append) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedBoards,
        String(dto.append),
        'append',
      )
    }
    if (dto.prepend) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedBoards,
        String(dto.prepend),
        'prepend',
      )
    }
    if (dto.replace_part) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedBoards,
        String(dto.replace_part.replace_with),
        'replace',
        String(dto.replace_part.find),
      )
    }

    boardsToUpdate.push(
      ...updatedTexts.map((data) => ({ id: data.id.toString(), [field]: data.text })),
    )

    for (const updatedBoard of boardsToUpdate) {
      const updatedTextData = updatedTexts.find((data) => data.id.equals(updatedBoard.id))

      if (updatedTextData) {
        updatedBoard[field] = updatedTextData.text
      }
    }

    return await this.boardService.editMany(boardsToUpdate, user, session)
  }

  public async translateEditWorkspaceAndExecute(
    boardIds: string[],
    workspaceId: string,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
    if (!workspaceId) {
      return {
        data: [],
        logId: null,
      }
    }

    const boardsToUpdate: BoardEditDTO[] = []

    const existingBoards = await this.boardService.getByCriteria(
      { ids: boardIds },
      user.id,
      session,
    )

    for (const board of existingBoards) {
      const updatedBoard = {
        id: board.id.toString(),
      } as BoardEditDTO

      updatedBoard.workspaceId = workspaceId

      const workspaceCount = await this.workspaceService.getCount(
        { id: workspaceId },
        user.id,
        session,
      )

      if (workspaceCount === 0) {
        throw new NotFoundError(`Workspace with id ${workspaceId} not found`)
      }

      boardsToUpdate.push(updatedBoard)
    }

    return await this.boardService.editMany(boardsToUpdate, user, session)
  }
}
