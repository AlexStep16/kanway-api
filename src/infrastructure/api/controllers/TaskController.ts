import { TaskService } from '@application/services/TaskService.js'
import { ITask } from '@entities/ITask.js'
import { TaskDTO } from '@application/dtos/TaskDTO.js'
import { BaseController } from '@controllers/BaseController.js'
import { ITaskCriteria } from '@interfaces/criterias/ITaskCriteria.js'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.js'
import { TaskEditDTO } from '@dtos/TaskEditDTO.js'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.js'
import { TaskMoveDTO } from '@/application/dtos/TaskMoveDTO.js'
import { TaskMoveManyDTO } from '@/application/dtos/TaskMoveManyDTO.js'
import { IUser } from '@/domain/entities/IUser.js'

export default class TaskController extends BaseController<
  ITask,
  TaskService,
  ITaskCriteria,
  TaskDTO,
  TaskEditDTO,
  ITaskPopulated,
  TaskMoveDTO
> {
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

  public moveMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as TaskMoveManyDTO
      const result = await this.service.moveMany(payload, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }
}
