import { model, Schema } from 'mongoose'
import { ISupportRaw } from '@entities/ISupportRaw.ts'

const SupportSchema = new Schema<ISupportRaw>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    theme: {
      type: Number,
      required: true,
    },
    details: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
)

const Support = model<ISupportRaw>('Support', SupportSchema)

export default Support
