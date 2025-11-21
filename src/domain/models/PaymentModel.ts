import { model, Schema } from 'mongoose'
import { IPaymentRaw } from '@entities/IPaymentRaw.ts'
import { PaymentStatusEnum } from '../enums/PaymentStatusEnum.ts'

export const PaymentSchema = new Schema<IPaymentRaw>(
  {
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    status: {
      type: Number,
      enum: PaymentStatusEnum,
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
)

const Payment = model<IPaymentRaw>('Payment', PaymentSchema)

export default Payment
