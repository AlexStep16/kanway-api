import { Types } from 'mongoose'

export interface IUser {
  id: Types.ObjectId
  username?: string
  email: string
  passwordHash: string
  role?: string
  isDeleted?: boolean
  deletedTime?: Date
  isConfirmed: boolean
  isPasswordInResetState?: boolean
  subscription: string
  subscriptionUntil?: Date | null
  generationsBalance: number
  avatarColor: string
  isTipsCompleted?: boolean
  phone?: string
  yaAvatarId?: string
  yaId?: string
  paymentMethodId?: string | null
}
