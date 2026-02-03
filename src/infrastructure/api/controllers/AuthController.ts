import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { AuthService } from '@application/services/AuthService.ts'
import { NextFunction, Request, Response } from 'express'
import { LoginCredentialsDTO } from '@/application/dtos/LoginCredentialsDTO.ts'
import { Redis } from 'ioredis'
import { AppError } from '@/domain/errors/AppError.ts'

const redis = new Redis()

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

  public async sendVerificationEmailByToken(req: Request, res: Response, next: NextFunction) {
    const ipKey = `limit:ip:${req.ip}`

    try {
      const ipRequests = await redis.incr(ipKey)

      if (ipRequests === 1) {
        await redis.expire(ipKey, 3600)
      }

      if (ipRequests > 10) {
        throw new AppError('Слишком много запросов с вашего IP-адреса. Попробуйте позже.', 429)
      }

      const token = req.params.token

      await this.service.sendVerificationEmailByToken(token)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      await redis.decr(ipKey)
      next(error)
    }
  }

  public async sendResetPasswordEmail(req: Request, res: Response, next: NextFunction) {
    const ipKey = `limit:ip:${req.ip}`

    try {
      const ipRequests = await redis.incr(ipKey)

      if (ipRequests === 1) {
        await redis.expire(ipKey, 3600)
      }

      if (ipRequests > 10) {
        throw new AppError('Слишком много запросов с вашего IP-адреса. Попробуйте позже.', 429)
      }

      const email = req.body.email.toLowerCase().trim()

      await this.service.sendResetPasswordEmail(email)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      await redis.decr(ipKey)
      next(error)
    }
  }

  public async sendResetPasswordEmailByToken(req: Request, res: Response, next: NextFunction) {
    const ipKey = `limit:ip:${req.ip}`

    try {
      const ipRequests = await redis.incr(ipKey)

      if (ipRequests === 1) {
        await redis.expire(ipKey, 3600)
      }

      if (ipRequests > 10) {
        throw new AppError('Слишком много запросов с вашего IP-адреса. Попробуйте позже.', 429)
      }

      const token = req.params.token

      await this.service.sendResetPasswordEmailByToken(token)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      await redis.decr(ipKey)
      next(error)
    }
  }

  public async changeUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body

      const { user, serialized } = await this.service.changeUserPassword(token, password)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async validateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, type } = req.body

      await this.service.validateToken(token, type)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async confirmEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body

      await this.service.confirmEmail(token)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }
}
