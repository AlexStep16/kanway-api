import { EditBoardsDTO } from '@application/ai/tools/toolSchemes.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { BaseService } from '@application/services/BaseService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { BoardService } from '@application/services/BoardService.ts'
import { IBoard } from '@/domain/entities/IBoard.ts'

export class BoardCommandAdapterService {
  protected boardService: BoardService
  protected baseService: BaseService
  protected aiSemanticService: AISemanticService

  constructor(
    boardService: BoardService,
    baseService: BaseService,
    aiSemanticService: AISemanticService
  ) {
    this.boardService = boardService
    this.baseService = baseService
    this.aiSemanticService = aiSemanticService
  }

  public async translateAndExecute(
    boardIds: string[],
    changes: EditBoardsDTO['changes'],
    user: IUser,
    session?: ClientSession,
    threadId?: string
  ): Promise<IResponseWithLog<IBoard[]>> {
    const boardsToUpdate: BoardEditDTO[] = []

    const existingBoards = await this.boardService.getAll({ ids: boardIds }, user.id, session)

    for (const board of existingBoards) {
      const updatedBoard = {
        id: board.id.toString(),
        threadId: threadId,
      } as BoardEditDTO

      if (typeof changes.workspaceId !== 'undefined' && typeof changes.workspaceId === 'string') {
        updatedBoard.workspaceId = changes.workspaceId
      }

      if (typeof changes.order !== 'undefined') {
        if (typeof changes.order === 'string') updatedBoard.order = parseInt(changes.order, 10)
        else if (typeof changes.order === 'number') updatedBoard.order = changes.order
      }

      boardsToUpdate.push(updatedBoard)
    }

    if (typeof changes.name !== 'undefined') {
      let updatedNames: { id: string; name: string }[] = []

      if (changes.name.set) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingBoards,
          String(changes.name.set),
          'set'
        )
      } else if (changes.name.append) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingBoards,
          String(changes.name.append),
          'append'
        )
      } else if (changes.name.prepend) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingBoards,
          String(changes.name.prepend),
          'prepend'
        )
      } else if (changes.name.replace_part) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingBoards,
          String(changes.name.replace_part.replace_with),
          'replace',
          String(changes.name.replace_part.find)
        )
      }

      for (const updatedBoard of boardsToUpdate) {
        const updatedNameData = updatedNames.find((data) => data.id === updatedBoard.id.toString())

        if (updatedNameData) {
          updatedBoard.name = updatedNameData.name
        }
      }
    }

    return await this.boardService.editMany(boardsToUpdate, user, session)
  }
}
