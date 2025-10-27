import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { Request, Response, NextFunction } from 'express'

export abstract class BaseController<TEntity, TService extends IBaseService<TEntity>> {
  protected service: TService

  constructor(serviceInstance: TService) {
    this.service = serviceInstance
  }

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newEntity = await this.service.create(req.body, req.user.id)

      res.status(201).json(new SuccessResponse(newEntity))
    } catch (error) {
      next(error)
    }
  }

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = await this.service.getById(req.params.id, req.user.id)

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.edit(req.body, { _id: req.params.id }, req.user.id)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete({ _id: req.params.id }, req.user.id)

      res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }
}
