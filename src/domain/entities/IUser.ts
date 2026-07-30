import { Types } from 'mongoose'
import { SubscriptionPlanEnum } from '../enums/SubscriptionPlanEnum.js'

export interface IUser {
  id: Types.ObjectId
  username?: string
  email: string
  passwordHash?: string
  hasPassword: boolean
  avatarUrl?: string
  timezone: string
  role?: string
  isDeleted?: boolean
  deletedTime?: Date
  isConfirmed: boolean
  subscriptionId: SubscriptionPlanEnum
  subscriptionUntil?: Date | null
  isSubscriptionActive?: boolean
  credits: number
  paidCredits: number
  avatarColor: string
  isTipsCompleted?: boolean
  phone?: string
  yandexUserId?: string
  vkUserId?: string
  paymentMethodId?: string | null
  paymentRetriesCount: number
  pendingChangePlan?: SubscriptionPlanEnum | null
  createdAt: Date
  updatedAt: Date
}
