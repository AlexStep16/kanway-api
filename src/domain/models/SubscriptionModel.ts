import { model, Schema } from 'mongoose'
import { ISubscriptionRaw } from '@entities/ISubscriptionRaw.ts'

export const SubscriptionSchema = new Schema<ISubscriptionRaw>({
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    required: true,
  },
  limit_workspaces: {
    type: Number,
    required: true,
  },
  limit_boards: {
    type: Number,
    required: true,
  },
})

const Subscription = model<ISubscriptionRaw>('Subscription', SubscriptionSchema)

export default Subscription
