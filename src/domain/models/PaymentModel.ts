import { model, Schema } from 'mongoose'
import { IPaymentRaw } from '@entities/IPaymentRaw.ts'
import { PaymentStatusesEnum } from '../enums/PaymentStatusesEnum.ts'

export const PaymentSchema = new Schema<IPaymentRaw>(
  {
    service_id: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    type: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: PaymentStatusesEnum,
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
)

const Payment = model<IPaymentRaw>('Payment', PaymentSchema)

export default Payment
