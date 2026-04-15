import { ClientSession, Types } from 'mongoose'
import { BoardService } from './BoardService.js'
import { WorkspaceService } from './WorkspaceService.js'
import { SUBSCRIPTION_LIMITS } from '@/constants/SUBSCRIPTION_LIMITS.js'
import { IUser } from '@/domain/entities/IUser.js'
import { AppError } from '@/domain/errors/AppError.js'

export class LimitService {
  private boardService: BoardService
  private workspaceService: WorkspaceService

  constructor(boardService: BoardService, workspaceService: WorkspaceService) {
    this.boardService = boardService
    this.workspaceService = workspaceService
  }

  public async checkBoardsLimit(
    user: IUser,
    workspaceId: string,
    session: ClientSession,
  ): Promise<void> {
    const maxBoards = SUBSCRIPTION_LIMITS[user.subscriptionId].boards
    if (maxBoards === Infinity) return

    const boardsCount = await this.boardService.getCount(
      { workspaceId, isDeleted: false },
      user.id,
      session,
    )

    if (boardsCount >= maxBoards) {
      throw new AppError(`Вы достигли лимита по количеству досок - ${maxBoards}.`, 403)
    }
  }

  public async checkBoardsLimitByWorkspaces(
    user: IUser,
    workspaceIds: string[],
    incomingCounts: Record<string, number>,
    session: ClientSession,
  ): Promise<void> {
    const maxBoards = SUBSCRIPTION_LIMITS[user.subscriptionId].boards
    if (maxBoards === Infinity) return

    const boardsCountGrouped = await this.boardService.getBoardsCountByWorkspaces(
      workspaceIds.map((id) => new Types.ObjectId(id)),
      user.id,
      session,
    )

    boardsCountGrouped.forEach((group) => {
      const currentInDb = group.count || 0
      const requestedToAdd = incomingCounts[group.parentId]

      if (currentInDb + requestedToAdd > maxBoards) {
        throw new AppError(
          `Вы достигли лимита по количеству досок - ${maxBoards} в одном из выбранных пространств.`,
          403,
        )
      }
    })
  }

  public async checkWorkspacesLimit(user: IUser, session: ClientSession): Promise<void> {
    const maxWorkspaces = SUBSCRIPTION_LIMITS[user.subscriptionId].workspaces
    if (maxWorkspaces === Infinity) return

    const workspacesCount = await this.workspaceService.getCount(
      { isDeleted: false },
      user.id,
      session,
    )

    if (workspacesCount >= maxWorkspaces) {
      throw new AppError(`Вы достигли лимита по количеству пространств - ${maxWorkspaces}.`, 403)
    }
  }
}
