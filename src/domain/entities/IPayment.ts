import { PaymentStatusesEnum } from '@domain/enums/PaymentStatusesEnum.js'
import { Types } from 'mongoose'
import { SubscriptionPlanEnum } from '../enums/SubscriptionPlanEnum.js'

export interface IPayment {
  id: Types.ObjectId
  serviceId: string
  description: string
  amount: string
  currency: string
  type: SubscriptionPlanEnum
  status: PaymentStatusesEnum
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
