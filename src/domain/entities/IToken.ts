import { Types } from 'mongoose'

export interface IToken {
  _id: Types.ObjectId
  token: String
  type: Number
  user_id: Types.ObjectId
}
