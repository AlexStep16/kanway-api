import SuccessResponse from '@application/services/SuccessResponse.js'
import { Request, Response, NextFunction } from 'express'
import { PaymentService } from '@/application/services/PaymentService.js'

export class PaymentController {
  protected service: PaymentService

  constructor(serviceInstance: PaymentService) {
    this.service = serviceInstance
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payments = await this.service.getByCriteria({}, req.user!.id, undefined, undefined, {
        sort: { createdAt: -1 },
      })

      res.status(200).json(new SuccessResponse(payments))
    } catch (error) {
      next(error)
    }
  }

  public notifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.handleNotification(req.body)

      res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public buySubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subscriptionId } = req.body

      const result = await this.service.buySubscription(req.user!, subscriptionId)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public buyCredits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId } = req.body

      const result = await this.service.buyCredits(req.user!, itemId)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public upgradeSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subscriptionId } = req.body

      const result = await this.service.upgradeSubscription(req.user!, subscriptionId)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public downgradeSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subscriptionId } = req.body

      const result = await this.service.downgradeSubscription(req.user!, subscriptionId)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public downgradeCancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.downgradeCancelSubscription(req.user!)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public cancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.cancelSubscription(req.user!)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public resumeSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.resumeSubscription(req.user!)

      res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }
}
