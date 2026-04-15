import SuccessResponse from '@application/services/SuccessResponse.js'
import { Request, Response, NextFunction } from 'express'
import { IUser } from '@/domain/entities/IUser.js'
import { OperationLogService } from '@/application/services/OperationLogService.js'
import { NotFoundError } from '@/domain/errors/NotFound.js'

export class OperationLogController {
  protected service: OperationLogService

  constructor(serviceInstance: OperationLogService) {
    this.service = serviceInstance
  }

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id }

      const logs = await this.service.getByCriteria(criteria, req.user!.id)

      if (logs.length === 0) {
        throw new NotFoundError('Лог не найден')
      }

      for (const log of logs) {
        await this.service.populateEntities(
          log.entitiesBefore ?? [],
          log.entitiesAfter ?? [],
          req.user!.id,
        )
      }

      res.status(200).json(new SuccessResponse(logs))
    } catch (error) {
      next(error)
    }
  }

  public undoOperations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.undoOperations([req.params.id], req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }
}
