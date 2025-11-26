import { BoardService } from '@/application/services/BoardService.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { NextFunction, Request, Response } from 'express'

export default class ArchiveController {
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    taskServiceInstance: TaskService,
    categoryServiceInstance: CategoryService,
    boardServiceInstance: BoardService,
    workspaceServiceInstance: WorkspaceService
  ) {
    this.taskService = taskServiceInstance
    this.categoryService = categoryServiceInstance
    this.boardService = boardServiceInstance
    this.workspaceService = workspaceServiceInstance
  }

  public async getAllArchivedTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.taskService.getAll({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public async getAllArchivedCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.categoryService.getAll({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public async getAllArchivedBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.boardService.getAll({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public async getAllArchivedWorkspaces(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.workspaceService.getAll({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
