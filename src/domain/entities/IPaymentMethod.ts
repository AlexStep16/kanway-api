import { Types } from 'mongoose'

export interface IPaymentMethod {
  id: Types.ObjectId
  serviceId: string
  type: string
  cardFirst6: string
  cardLast4: string
  cardType: string
  expiryMonth: number
  expiryYear: number
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
