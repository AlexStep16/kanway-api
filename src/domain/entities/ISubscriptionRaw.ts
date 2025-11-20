import { Types } from 'mongoose'

export interface ISubscriptionRaw {
  _id: Types.ObjectId
  id: number
  name: string
  price: number
  currency: string
  interval: 'month' | 'year'
  limit_workspaces: number
  limit_boards: number
  limit_ai_messages_per_month: number
}
