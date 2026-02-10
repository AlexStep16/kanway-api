import { IUser } from '@entities/IUser.ts'
import { Request } from 'express'
import { RateLimitInfo } from 'express-rate-limit'

declare global {
  namespace Express {
    interface User extends IUser {}
    interface Request {
      rateLimit?: RateLimitInfo
    }
  }
}
