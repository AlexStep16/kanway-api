import { model, Schema } from 'mongoose'
import { IPaymentRaw } from '@entities/IPaymentRaw.js'
import { PaymentStatusesEnum } from '../enums/PaymentStatusesEnum.js'
import { PaymentTypeEnum } from '../enums/PaymentTypeEnum.js'
import { PaymentItemIdEnum } from '../enums/PaymentItemIdEnum.js'

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
    column: {
      type: String,
      enum: PaymentTypeEnum,
      required: true,
    },
    item_id: {
      type: Number,
      enum: PaymentItemIdEnum,
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
