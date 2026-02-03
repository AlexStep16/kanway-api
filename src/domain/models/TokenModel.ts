import { model, Schema } from 'mongoose'
import { ITokenRaw } from '@entities/ITokenRaw.ts'

export const TokenSchema = new Schema<ITokenRaw>(
  {
    token: {
      type: String,
      required: true,
    },
    type: {
      type: Number,
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

const Token = model<ITokenRaw>('Token', TokenSchema)

export default Token
