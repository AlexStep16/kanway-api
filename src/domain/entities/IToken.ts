import { Types } from 'mongoose'

export interface IToken {
  id: Types.ObjectId
  token: String
  type: Number
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
