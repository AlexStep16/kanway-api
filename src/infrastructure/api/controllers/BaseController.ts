import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { Request, Response, NextFunction } from 'express'

export abstract class BaseController<
  TEntity,
  TCreateDTO,
  TCriteria,
  TService extends IBaseService<TEntity, TCriteria, TCreateDTO>
> {
  protected service: TService

  constructor(serviceInstance: TService) {
    this.service = serviceInstance
  }

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newEntity = await this.service.create(req.body, req.user!.id)

      res.status(201).json(new SuccessResponse(newEntity))
    } catch (error) {
      next(error)
    }
  }

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = await this.service.getById(req.params.id, req.user!.id)

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entities = await this.service.getAll({} as TCriteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as TCriteria
      const result = await this.service.edit(req.body, criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as TCriteria
      await this.service.delete(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public archive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as TCriteria
      const result = await this.service.archive(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public recover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as TCriteria
      const result = await this.service.recover(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public clone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as TCriteria
      const result = await this.service.clone(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }
}
