import { PaymentStatusesEnum } from '@/domain/enums/PaymentStatusesEnum.js'
import { Types } from 'mongoose'
import { SubscriptionPlanEnum } from '../enums/SubscriptionPlanEnum.js'

export interface IPaymentRaw {
  _id: Types.ObjectId
  service_id: string
  description: string
  amount: string
  currency: string
  type: SubscriptionPlanEnum
  status: PaymentStatusesEnum
  user_id: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
