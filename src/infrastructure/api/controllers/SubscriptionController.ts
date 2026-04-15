import SuccessResponse from '@application/services/SuccessResponse.js'
import { SubscriptionService } from '@application/services/SubscriptionService.js'
import { Request, Response, NextFunction } from 'express'

export class SubscriptionController {
  protected service: SubscriptionService

  constructor(serviceInstance: SubscriptionService) {
    this.service = serviceInstance
  }

  public getAll = async (_: Request, res: Response, next: NextFunction) => {
    try {
      const entity = await this.service.getByCriteria({})

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }
}
