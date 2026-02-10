import { IUserCriteria } from '@criterias/IUserCriteria.ts'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { UserService } from '@application/services/UserService.ts'
import { Request, Response, NextFunction } from 'express'
import { AppError } from '@errors/AppError.ts'
import { IUser } from '@entities/IUser.ts'
import { EmailService } from '@/infrastructure/services/EmailService.ts'

export class UserController {
  protected service: UserService
  protected emailService: EmailService

  constructor(serviceInstance: UserService, emailServiceInstance: EmailService) {
    this.service = serviceInstance
    this.emailService = emailServiceInstance
  }

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.user!.id.toHexString() } as IUserCriteria
      const result = await this.service.edit(req.body, criteria, req.user as IUser)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.user!.id.toHexString() } as IUserCriteria
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

  public resetAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.resetAvatar(req.user!.id)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async sendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      await this.service.sendVerificationEmail(req.user!)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async logout(_: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      })

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }
}
