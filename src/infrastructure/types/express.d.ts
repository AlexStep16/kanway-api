import { IUser } from '@entities/IUser.ts'

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}
