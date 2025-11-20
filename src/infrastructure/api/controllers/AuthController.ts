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
    const credentials = req.body as RegisterCredentialsDTO

    try {
      const { user, serialized } = await this.service.register(credentials)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async login(req: Request, res: Response, next: NextFunction) {
    const credentials = req.body as LoginCredentialsDTO

    try {
      const { user, serialized } = await this.service.login(credentials)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }
}
