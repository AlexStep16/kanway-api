import { Types } from 'mongoose'

export interface IPaymentMethodRaw {
  _id: Types.ObjectId
  service_id: string
  type: string
  card_first_6: string
  card_last_4: string
  card_type: string
  expiry_month: number
  expiry_year: number
  user_id: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
