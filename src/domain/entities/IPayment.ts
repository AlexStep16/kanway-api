import { PaymentStatusesEnum } from '@domain/enums/PaymentStatusesEnum.js'
import { Types } from 'mongoose'
import { PaymentTypeEnum } from '../enums/PaymentTypeEnum.js'
import { PaymentItemIdEnum } from '../enums/PaymentItemIdEnum.js'

export interface IPayment {
  id: Types.ObjectId
  serviceId: string
  description: string
  amount: string
  currency: string
  category: PaymentTypeEnum
  itemId: PaymentItemIdEnum
  status: PaymentStatusesEnum
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
