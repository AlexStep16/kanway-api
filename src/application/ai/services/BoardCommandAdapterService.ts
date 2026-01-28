import { EditBoardsDTO } from '@application/ai/tools/toolSchemes.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { BoardService } from '@application/services/BoardService.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'

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

  public async translateAndExecute(
    boardIds: string[],
    changes: EditBoardsDTO['changes'],
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<IBoardPopulated[]>> {
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

      if (typeof changes.workspaceId !== 'undefined' && typeof changes.workspaceId === 'string') {
        updatedBoard.workspaceId = changes.workspaceId

        const workspacesCount = await this.workspaceService.getCount(
          { id: changes.workspaceId },
          user.id,
          session,
        )

        if (workspacesCount === 0) {
          throw new NotFoundError(`Workspace with id ${changes.workspaceId} not found`)
        }
      }

      if (typeof changes.order !== 'undefined') {
        if (typeof changes.order === 'string') updatedBoard.order = parseInt(changes.order, 10)
        else if (typeof changes.order === 'number') updatedBoard.order = changes.order
      }

      if (typeof changes.isFavorite !== 'undefined') {
        updatedBoard.isFavorite = Boolean(changes.isFavorite)
      }

      boardsToUpdate.push(updatedBoard)
    }

    if (boardsToUpdate.length === 0)
      return {
        data: [],
        logId: null,
      }

    if (typeof changes.name !== 'undefined') {
      let updatedNames: { id: Types.ObjectId; name: string }[] = []

      if (changes.name.set) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingBoards,
          String(changes.name.set),
          'set',
        )
      }
      if (changes.name.append) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingBoards,
          String(changes.name.append),
          'append',
        )
      }
      if (changes.name.prepend) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingBoards,
          String(changes.name.prepend),
          'prepend',
        )
      }
      if (changes.name.replace_part) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingBoards,
          String(changes.name.replace_part.replace_with),
          'replace',
          String(changes.name.replace_part.find),
        )
      }

      for (const updatedBoard of boardsToUpdate) {
        const updatedNameData = updatedNames.find((data) => data.id.equals(updatedBoard.id))

        if (updatedNameData) {
          updatedBoard.name = updatedNameData.name
        }
      }
    }

    return await this.boardService.editMany(boardsToUpdate, user, session)
  }
}
