import { Types } from 'mongoose'

export interface IToken {
  id: Types.ObjectId
  token: string
  type: Number
  userId: Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
