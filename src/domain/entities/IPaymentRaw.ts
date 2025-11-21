import { PaymentStatusEnum } from '@/domain/enums/PaymentStatusEnum.ts'
import { Types } from 'mongoose'

export interface IPaymentRaw {
  _id: Types.ObjectId
  description: string
  amount: number
  currency: string
  status: PaymentStatusEnum
  user_id: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
