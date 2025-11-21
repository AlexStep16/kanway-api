import { PaymentStatusEnum } from '@/domain/enums/PaymentStatusEnum.ts'
import { Types } from 'mongoose'

export interface IPayment {
  id: Types.ObjectId
  description: string
  amount: number
  currency: string
  status: PaymentStatusEnum
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
