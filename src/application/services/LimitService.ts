import { ClientSession, Types } from 'mongoose'
import { BoardService } from './BoardService.js'
import { WorkspaceService } from './WorkspaceService.js'
import { SUBSCRIPTION_LIMITS } from '@/constants/SUBSCRIPTION_LIMITS.js'
import { IUser } from '@/domain/entities/IUser.js'
import { AppError } from '@/domain/errors/AppError.js'
import { ColumnService } from './ColumnService.js'
import { TaskService } from './TaskService.js'

const MAX_COLUMNS_PER_BOARD = 20
const MAX_TASKS_PER_BOARD = 100

export class LimitService {
  private boardService: BoardService
  private columnService: ColumnService
  private taskService: TaskService
  private workspaceService: WorkspaceService

  constructor(
    boardService: BoardService,
    columnService: ColumnService,
    taskService: TaskService,
    workspaceService: WorkspaceService,
  ) {
    this.boardService = boardService
    this.columnService = columnService
    this.taskService = taskService
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

    const dbCountsMap = new Map(
      boardsCountGrouped.map((group) => [group.parentId.toString(), group.count]),
    )

    workspaceIds.forEach((workspaceId) => {
      const currentInDb = dbCountsMap.get(workspaceId) || 0
      const requestedToAdd = incomingCounts[workspaceId]

      if (currentInDb + requestedToAdd > maxBoards) {
        throw new AppError(
          `Вы достигли лимита по количеству досок - ${maxBoards} в одном из выбранных пространств.`,
          403,
        )
      }
    })
  }

  public async checkColumnsLimit(
    user: IUser,
    boardId: string,
    session: ClientSession,
  ): Promise<void> {
    const maxColumns = MAX_COLUMNS_PER_BOARD

    const columnsCount = await this.columnService.getCount(
      { boardId, isDeleted: false },
      user.id,
      session,
    )

    if (columnsCount >= maxColumns) {
      throw new AppError(`Вы достигли лимита по количеству категорий - ${maxColumns}.`, 403)
    }
  }

  public async checkColumnsLimitByBoards(
    user: IUser,
    boardIds: string[],
    incomingCounts: Record<string, number>,
    session: ClientSession,
  ): Promise<void> {
    const columnsCountGrouped = await this.columnService.getColumnsCountByBoards(
      boardIds.map((id) => new Types.ObjectId(id)),
      user.id,
      session,
    )

    const dbCountsMap = new Map(
      columnsCountGrouped.map((group) => [group.parentId.toString(), group.count]),
    )

    boardIds.forEach((boardId) => {
      const currentInDb = dbCountsMap.get(boardId) || 0
      const requestedToAdd = incomingCounts[boardId]

      if (currentInDb + requestedToAdd > MAX_COLUMNS_PER_BOARD) {
        throw new AppError(
          `Вы достигли лимита по количеству категорий - ${MAX_COLUMNS_PER_BOARD} в одной из выбранных досок.`,
          403,
        )
      }
    })
  }

  public async checkTasksLimit(
    user: IUser,
    boardId: string,
    session: ClientSession,
  ): Promise<void> {
    const maxTasks = MAX_TASKS_PER_BOARD

    const tasksCount = await this.taskService.getCount(
      { boardId, isDeleted: false },
      user.id,
      session,
    )

    if (tasksCount >= maxTasks) {
      throw new AppError(`Вы достигли лимита по количеству задач - ${maxTasks}.`, 403)
    }
  }

  public async checkTasksLimitByBoards(
    user: IUser,
    boardIds: string[],
    incomingCounts: Record<string, number>,
    session: ClientSession,
  ): Promise<void> {
    const tasksCountGrouped = await this.taskService.getTasksCountByBoards(
      boardIds.map((id) => new Types.ObjectId(id)),
      user.id,
      session,
    )

    const dbCountsMap = new Map(
      tasksCountGrouped.map((group) => [group.parentId.toString(), group.count]),
    )

    boardIds.forEach((boardId) => {
      const currentInDb = dbCountsMap.get(boardId) || 0
      const requestedToAdd = incomingCounts[boardId]

      if (currentInDb + requestedToAdd > MAX_TASKS_PER_BOARD) {
        throw new AppError(
          `Вы достигли лимита по количеству задач - ${MAX_TASKS_PER_BOARD} в одной из выбранных досок.`,
          403,
        )
      }
    })
  }

  public async checkWorkspacesLimit(
    user: IUser,
    incomingCount: number,
    session: ClientSession,
  ): Promise<void> {
    const maxWorkspaces = SUBSCRIPTION_LIMITS[user.subscriptionId].workspaces
    if (maxWorkspaces === Infinity) return

    const workspacesCount = await this.workspaceService.getCount(
      { isDeleted: false },
      user.id,
      session,
    )

    if (workspacesCount + incomingCount > maxWorkspaces) {
      throw new AppError(`Вы достигли лимита по количеству пространств - ${maxWorkspaces}.`, 403)
    }
  }
}
