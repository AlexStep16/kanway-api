import { model, Schema } from 'mongoose'
import { IToken } from '../entities/IToken.ts'

export const TokenSchema = new Schema<IToken>(
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
  },
  { timestamps: true }
)

const Token = model<IToken>('Token', TokenSchema)

export default Token
