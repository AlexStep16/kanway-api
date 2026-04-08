import { Types } from 'mongoose'
import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.ts'

export interface ISubscriptionRaw {
  _id: Types.ObjectId
  id: SubscriptionPlanEnum
  name: string
  price: number
  currency: string
  interval: 'month' | 'year'
  limit_workspaces: number
  limit_boards: number
}
