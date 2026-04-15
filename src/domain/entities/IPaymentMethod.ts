import { IPaymentMethodType } from '@/application/interfaces/IPaymentMethodType.js'
import { Types } from 'mongoose'

export interface IPaymentMethod {
  id: Types.ObjectId
  serviceId: string
  paymentId: string
  type: IPaymentMethodType
  cardFirst6?: string
  cardLast4?: string
  cardType?: string
  cardExpiryMonth?: string
  cardExpiryYear?: string
  phone?: string
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
