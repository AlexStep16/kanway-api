import { Types } from 'mongoose'

export interface IUserRaw {
  _id: Types.ObjectId
  username?: string
  email: string
  password_hash: string
  role?: string
  is_deleted?: boolean
  deleted_time?: Date
  avatar_url?: string
  timezone: string
  is_confirmed: boolean
  is_password_in_reset_state?: boolean
  subscription_id: Types.ObjectId
  subscription_until?: Date | null
  generations_balance?: number
  avatar_color: string
  is_tips_completed?: boolean
  phone?: string
  ya_avatar_id?: string
  ya_id?: string
  payment_method_id?: string | null
  createdAt: Date
  updatedAt: Date
}
