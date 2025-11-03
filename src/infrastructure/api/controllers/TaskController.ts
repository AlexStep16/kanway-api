import { TaskService } from '@application/services/TaskService.ts'
import { ITask } from '@entities/ITask.ts'
import { TaskDTO } from '@application/dtos/TaskDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { TaskCriteria } from '@interfaces/criterias/TaskCriteria.ts'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.ts'

export default class TaskController extends BaseController<
  ITask,
  TaskDTO,
  TaskCriteria,
  TaskService
> {
  constructor(serviceInstance: TaskService) {
    super(serviceInstance)
  }

  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: TaskCriteria = { categoryId: req.params.categoryId }
      const entities = await this.service.getAll(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
