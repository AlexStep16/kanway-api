import { UserCriteria } from '@criterias/UserCriteria.ts'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { UserService } from '@application/services/UserService.ts'
import { Request, Response, NextFunction } from 'express'
import { AppError } from '@errors/AppError.ts'
import { IUser } from '@entities/IUser.ts'

export class UserController {
  protected service: UserService

  constructor(serviceInstance: UserService) {
    this.service = serviceInstance
  }

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.user!.id.toHexString() } as UserCriteria
      const result = await this.service.edit(req.body, criteria, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.user!.id.toHexString() } as UserCriteria
      await this.service.delete(criteria)

      res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.service.me(req.user!.id)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('Файл аватара не предоставлен', 400)
      }

      const newUrl = await this.service.updateAvatar(req.user!.id, req.file)

      return res.status(200).json(new SuccessResponse(newUrl))
    } catch (error) {
      next(error)
    }
  }
}
