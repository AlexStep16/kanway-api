import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { RegisterCredentials } from '@dtos/RegisterCredentials.ts'
import { AuthService } from '@application/services/AuthService.ts'
import { NextFunction, Request, Response } from 'express'
import { LoginCredentials } from '@dtos/LoginCredentials.ts'

export default class AuthController {
  protected service: AuthService

  constructor(serviceInstance: AuthService) {
    this.service = serviceInstance
  }

  public async register(req: Request, res: Response, next: NextFunction) {
    const { email, password } = req.body as RegisterCredentials

    const credentials: RegisterCredentials = { email, password }

    try {
      const { user, serialized } = await this.service.register(credentials)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async login(req: Request, res: Response, next: NextFunction) {
    const { email, password } = req.body as LoginCredentials

    const credentials: LoginCredentials = { email, password }

    try {
      const { user, serialized } = await this.service.login(credentials)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await this.service.me(req.user._id)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }
}
