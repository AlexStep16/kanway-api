import SuccessResponse from '@/application/services/SuccessResponse.js'
import { SignupCredentialsDTO } from '@/application/dtos/SignupCredentialsDTO.js'
import { AuthService } from '@application/services/AuthService.js'
import { NextFunction, Request, Response } from 'express'
import { SigninCredentialsDTO } from '@/application/dtos/SigninCredentialsDTO.js'
import { YandexAuthDTO } from '@/application/dtos/YandexAuthDTO.js'
import { UserService } from '@/application/services/UserService.js'
import { VkAuthDTO } from '@/application/dtos/VkAuthDTO.js'
import { FinishSignupCredentialsDTO } from '@/application/dtos/FinishSignupCredentialsDTO.js'
import { ProviderDTO } from '@/application/dtos/ProviderDTO.js'

export default class AuthController {
  protected service: AuthService
  protected userService: UserService

  constructor(serviceInstance: AuthService, userServiceInstance: UserService) {
    this.service = serviceInstance
    this.userService = userServiceInstance
  }

  public async register(req: Request, res: Response, next: NextFunction) {
    const credentials = req.body as SignupCredentialsDTO

    try {
      const { user, serialized } = await this.service.register(credentials)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async login(req: Request, res: Response, next: NextFunction) {
    const credentials = req.body as SigninCredentialsDTO

    try {
      const { user, serialized } = await this.service.login(credentials)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async yandex(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, serialized } = await this.service.yandex(req.body as YandexAuthDTO)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async vk(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, serialized } = await this.service.vk(req.body as VkAuthDTO)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async sendResetPasswordEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.body.email.toLowerCase().trim()

      await this.service.sendResetPasswordEmail(email)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async changeUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { password } = req.body

      const { user, serialized } = await this.service.changeUserPassword(req.userId!, password)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public async checkEmailExists(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.body.email as string

      const exists = await this.userService.checkEmailExists(email, req.ip)

      return res.status(200).json(new SuccessResponse(exists))
    } catch (error) {
      next(error)
    }
  }

  public async verifyLinkEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body

      const { serialized } = await this.service.verifyLinkEmail(token)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async verifyLinkLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body

      const { serialized } = await this.service.verifyLinkLogin(token)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async verifyLinkPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body

      const { serialized } = await this.service.verifyLinkPassword(token)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async verifyOTPLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, email } = req.body

      const { serialized } = await this.service.verifyOTPLogin(code, email)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async verifyOTPEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, email } = req.body

      const { serialized } = await this.service.verifyOTPEmail(code, email)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async verifyOTPPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, email } = req.body

      const { serialized } = await this.service.verifyOTPPassword(code, email)

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async sendMagicLink(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body

      await this.service.sendMagicLink(email)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public async finishSignup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body as FinishSignupCredentialsDTO
      const providerData = req.providerData as ProviderDTO

      const { user, serialized } = await this.service.finishSignup({ ...data, ...providerData })

      res.setHeader('Set-Cookie', serialized)

      return res.status(200).json(new SuccessResponse(user))
    } catch (error) {
      next(error)
    }
  }

  public checkSignup(req: Request, res: Response) {
    return res.status(200).json(new SuccessResponse(req.providerData))
  }

  public checkPasswordStrength(req: Request, res: Response, next: NextFunction) {
    try {
      const { password } = req.body
      const result = this.service.checkPasswordStrength(
        typeof password === 'string' ? password : '',
      )
      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }
}
