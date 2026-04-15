import { model, Schema } from 'mongoose'
import { IPaymentMethodRaw } from '@entities/IPaymentMethodRaw.js'

export const PaymentMethodSchema = new Schema<IPaymentMethodRaw>({
  service_id: {
    type: String,
    required: true,
    unique: true,
  },
  payment_id: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    required: true,
  },
  card_first6: {
    type: String,
    required: true,
  },
  card_last4: {
    type: String,
    required: true,
  },
  card_type: {
    type: String,
    required: true,
  },
  card_expiry_month: {
    type: String,
  },
  card_expiry_year: {
    type: String,
  },
  phone: {
    type: String,
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
})

const PaymentMethod = model<IPaymentMethodRaw>('PaymentMethod', PaymentMethodSchema)

export default PaymentMethod
