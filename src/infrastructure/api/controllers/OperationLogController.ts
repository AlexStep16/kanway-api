import SuccessResponse from '@application/services/SuccessResponse.ts'
import { Request, Response, NextFunction } from 'express'
import { IUser } from '@/domain/entities/IUser.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'

export class OperationLogController {
  protected service: OperationLogService

  constructor(serviceInstance: OperationLogService) {
    this.service = serviceInstance
  }

  public undoOperation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.undoOperation(req.params.id, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }
}
