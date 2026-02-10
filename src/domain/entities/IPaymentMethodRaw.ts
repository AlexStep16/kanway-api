import { IPaymentMethodType } from '@/application/interfaces/IPaymentMethodType.ts'
import { Types } from 'mongoose'

export interface IPaymentMethodRaw {
  _id: Types.ObjectId
  service_id: string
  payment_id: string
  type: IPaymentMethodType
  card_first6: string
  card_last4: string
  card_type: string
  card_expiry_month?: string
  card_expiry_year?: string
  phone?: string
  user_id: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
