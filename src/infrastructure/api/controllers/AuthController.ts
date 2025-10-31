import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { AuthService } from '@application/services/AuthService.ts'
import { NextFunction, Request, Response } from 'express'
import { LoginCredentialsDTO } from '@/application/dtos/LoginCredentialsDTO.ts'

export default class AuthController {
  protected service: AuthService

  constructor(serviceInstance: AuthService) {
    this.service = serviceInstance
  }

  public async register(req: Request, res: Response, next: NextFunction) {
    const { email, password } = req.body as RegisterCredentialsDTO

    const credentials: RegisterCredentialsDTO = { email, password }

    try {
      const { user, serialized } = await this.service.register(credentials)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async login(req: Request, res: Response, next: NextFunction) {
    const { email, password } = req.body as LoginCredentialsDTO

    const credentials: LoginCredentialsDTO = { email, password }

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
      const user = await this.service.me(req.user.id)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }
}
