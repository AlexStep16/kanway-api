import { Types } from 'mongoose'

export interface ITokenRaw {
  _id: Types.ObjectId
  token: String
  type: Number
  user_id: Types.ObjectId
  is_active: boolean
  createdAt: Date
  updatedAt: Date
}
