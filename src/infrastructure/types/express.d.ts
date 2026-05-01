import { ProviderDTO } from '@/application/dtos/ProviderDTO.ts'
import { IUser } from '@entities/IUser.js'
import { RateLimitInfo } from 'express-rate-limit'

declare global {
  namespace Express {
    interface User extends IUser {}
    interface Request {
      rateLimit?: RateLimitInfo
      userId?: string
      providerData?: ProviderDTO
    }
  }
}
