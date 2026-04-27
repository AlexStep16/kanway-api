import { Types } from 'mongoose'
import { SubscriptionPlanEnum } from '../enums/SubscriptionPlanEnum.js'

export interface IUserRaw {
  _id: Types.ObjectId
  username?: string
  email: string
  password_hash?: string
  is_initialized: boolean
  role?: string
  is_deleted?: boolean
  deleted_time?: Date
  avatar_url?: string
  timezone: string
  is_confirmed: boolean
  audio_tokens_used: number
  subscription_id: SubscriptionPlanEnum
  subscription_until?: Date | null
  is_subscription_active?: boolean
  credits: number
  paid_credits: number
  avatar_color: string
  is_tips_completed?: boolean
  phone?: string
  yandex_client_id?: string
  payment_method_id?: string | null
  payment_retries_count: number
  pending_change_plan?: SubscriptionPlanEnum | null
  createdAt: Date
  updatedAt: Date
}
