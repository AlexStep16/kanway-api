import { TaskService } from '@application/services/TaskService.ts'
import { ITask } from '@entities/ITask.ts'
import { TaskDTO } from '@application/dtos/TaskDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { ITaskCriteria } from '@interfaces/criterias/ITaskCriteria.ts'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'

export default class TaskController extends BaseController<
  ITask,
  TaskService,
  ITaskCriteria,
  TaskDTO,
  TaskEditDTO,
  ITaskPopulated
> {
  constructor(serviceInstance: TaskService) {
    super(serviceInstance)
  }

  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: ITaskCriteria = {
        boardId: req.params.boardId,
        ...req.query,
        isDeleted: false,
      }
      const entities = await this.service.getByCriteria(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
