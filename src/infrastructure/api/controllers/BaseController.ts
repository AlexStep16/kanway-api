import { IUser } from '@entities/IUser.ts'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { Request, Response, NextFunction } from 'express'
import { IControllerService } from '@interfaces/traits/IControllerService.ts'
import { IBaseCriteria } from '@/application/interfaces/IBaseCriteria.ts'

export abstract class BaseController<
  TEntity,
  TService extends IControllerService<TEntity, TCriteria, TCreateDTO, TEditDTO, TResult>,
  TCriteria extends IBaseCriteria,
  TCreateDTO,
  TEditDTO,
  TResult = Record<string, any>
> {
  constructor(protected service: TService) {}

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newEntity = await this.service.create(req.body, req.user as IUser)

      res.status(201).json(new SuccessResponse(newEntity))
    } catch (error) {
      next(error)
    }
  }

  public createMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newEntity = await this.service.createMany(req.body, req.user as IUser)

      res.status(201).json(new SuccessResponse(newEntity))
    } catch (error) {
      next(error)
    }
  }

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as unknown as TCriteria

      const entity = await this.service.getByCriteria(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { ...req.query, isDeleted: false } as unknown as TCriteria
      const entities = await this.service.getByCriteria(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }

  public getCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { ...req.query, isDeleted: false } as unknown as TCriteria
      const count = await this.service.getCount(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(count))
    } catch (error) {
      next(error)
    }
  }

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timezone = req.user?.timezone || 'Europe/Moscow'
      const payload = { ...req.body, timezone } as TEditDTO

      const criteria = { id: req.params.id } as TCriteria
      const result = await this.service.edit(payload, criteria, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public updateMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timezone = req.user?.timezone || 'Europe/Moscow'
      const payload = (req.body as TEditDTO[]).map((item) => ({ ...item, timezone }))

      const result = await this.service.editMany(payload, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as TCriteria
      await this.service.delete(criteria, req.user as IUser)

      res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public archive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id, isDeleted: false } as unknown as TCriteria
      const result = await this.service.archive(criteria, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public recover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id, isDeleted: true } as unknown as TCriteria
      const result = await this.service.recover(criteria, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public clone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id } as TCriteria
      const result = await this.service.clone(criteria, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }
}
