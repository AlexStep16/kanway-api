import { PaymentStatusesEnum } from '@/domain/enums/PaymentStatusesEnum.js'
import { Types } from 'mongoose'
import { PaymentTypeEnum } from '../enums/PaymentTypeEnum.js'
import { PaymentItemIdEnum } from '../enums/PaymentItemIdEnum.js'

export interface IPaymentRaw {
  _id: Types.ObjectId
  service_id: string
  description: string
  amount: string
  currency: string
  category: PaymentTypeEnum
  item_id?: PaymentItemIdEnum
  status: PaymentStatusesEnum
  user_id: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
