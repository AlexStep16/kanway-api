import SuccessResponse from '@application/services/SuccessResponse.ts'
import { Request, Response, NextFunction } from 'express'
import { SettingService } from '@application/services/SettingService.ts'

export class SettingController {
  protected service: SettingService

  constructor(serviceInstance: SettingService) {
    this.service = serviceInstance
  }

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.edit(req.body, {}, req.user!.id)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = await this.service.get(req.user!.id)

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }
}
