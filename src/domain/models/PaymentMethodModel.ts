import { model, Schema } from 'mongoose'
import { IPaymentMethodRaw } from '@entities/IPaymentMethodRaw.ts'

export const PaymentMethodSchema = new Schema<IPaymentMethodRaw>({
  service_id: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    required: true,
  },
  card_first_6: {
    type: String,
    required: true,
  },
  card_last_4: {
    type: String,
    required: true,
  },
  card_type: {
    type: String,
    required: true,
  },
  expiry_month: {
    type: Number,
    required: true,
  },
  expiry_year: {
    type: Number,
    required: true,
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
})

const PaymentMethod = model<IPaymentMethodRaw>('PaymentMethod', PaymentMethodSchema)

export default PaymentMethod
