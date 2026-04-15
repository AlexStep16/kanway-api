import { BoardService } from '@/application/services/BoardService.js'
import { CategoryService } from '@/application/services/CategoryService.js'
import SuccessResponse from '@/application/services/SuccessResponse.js'
import { TaskService } from '@/application/services/TaskService.js'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
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
    workspaceServiceInstance: WorkspaceService,
  ) {
    this.taskService = taskServiceInstance
    this.categoryService = categoryServiceInstance
    this.boardService = boardServiceInstance
    this.workspaceService = workspaceServiceInstance
  }

  public async getAllArchivedTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.taskService.getByCriteria({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public async getAllArchivedCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.categoryService.getByCriteria({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public async getAllArchivedBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.boardService.getByCriteria({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public async getAllArchivedWorkspaces(req: Request, res: Response, next: NextFunction) {
    try {
      const entities = await this.workspaceService.getByCriteria({ isDeleted: true }, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
