import { Request } from 'express'
import { IUser } from '@entities/User'

declare module 'express-serve-static-core' {
  interface Request {
    user: IUser
  }
}
