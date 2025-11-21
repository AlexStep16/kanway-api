import SuccessResponse from '@application/services/SuccessResponse.ts'
import { Request, Response, NextFunction } from 'express'
import { PaymentMethodService } from '@application/services/PaymentMethodService.ts'

export class PaymentMethodController {
  protected service: PaymentMethodService

  constructor(serviceInstance: PaymentMethodService) {
    this.service = serviceInstance
  }

  public deleteById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteById(req.params.id, req.user!.id)

      res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = await this.service.getAllByUserId(req.user!.id)

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }
}
