import { TaskService } from '@application/services/TaskService.ts'
import { ITask } from '@entities/ITask.ts'
import { TaskDTO } from '@application/dtos/TaskDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { TaskCriteria } from '@interfaces/criterias/TaskCriteria.ts'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import { ITaskServerResponse } from '@entities/ITaskServerResponse.ts'

export default class TaskController extends BaseController<
  ITask,
  TaskDTO,
  TaskCriteria,
  TaskService,
  TaskEditDTO,
  ITaskServerResponse[]
> {
  constructor(serviceInstance: TaskService) {
    super(serviceInstance)
  }

  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: TaskCriteria = { boardId: req.params.boardId }
      const entities = await this.service.getAll(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
