import SuccessResponse from '@application/services/SuccessResponse.ts'
import { Request, Response, NextFunction } from 'express'
import { PaymentService } from '@/application/services/PaymentService.ts'

export class PaymentController {
  protected service: PaymentService

  constructor(serviceInstance: PaymentService) {
    this.service = serviceInstance
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = await this.service.getByCriteria({ id: req.user!.id.toString() })

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }
}
