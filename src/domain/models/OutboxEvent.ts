import { Schema, model } from 'mongoose'
import { IOutboxEventRaw } from '@entities/IOutboxEventRaw.js'
import { OutboxEventTypeEnum } from '../enums/OutboxEventTypeEnum.js'
import { OutboxEventStatusEnum } from '../enums/OutboxEventStatusEnum.js'

const OutboxEventSchema = new Schema<IOutboxEventRaw>(
  {
    type: {
      type: String,
      enum: OutboxEventTypeEnum,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: OutboxEventStatusEnum,
      default: OutboxEventStatusEnum.PENDING,
    },
    processed_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

OutboxEventSchema.index({ processed_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 })

OutboxEventSchema.index(
  { createdAt: 1 },
  {
    partialFilterExpression: {
      status: OutboxEventStatusEnum.PENDING,
    },
  },
)

const OutboxEvent = model<IOutboxEventRaw>('OutboxEvent', OutboxEventSchema)

export default OutboxEvent
