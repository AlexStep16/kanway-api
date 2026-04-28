import { Types } from 'mongoose'
import { SubscriptionPlanEnum } from '../enums/SubscriptionPlanEnum.js'

export interface IUser {
  id: Types.ObjectId
  username?: string
  email: string
  passwordHash?: string
  avatarUrl?: string
  timezone: string
  role?: string
  isDeleted?: boolean
  deletedTime?: Date
  isConfirmed: boolean
  audioTokensUsed: number
  subscriptionId: SubscriptionPlanEnum
  subscriptionUntil?: Date | null
  isSubscriptionActive?: boolean
  credits: number
  paidCredits: number
  avatarColor: string
  isTipsCompleted?: boolean
  phone?: string
  yandexClientId?: string
  vkClientId?: string
  paymentMethodId?: string | null
  paymentRetriesCount: number
  pendingChangePlan?: SubscriptionPlanEnum | null
  createdAt: Date
  updatedAt: Date
}
