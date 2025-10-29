import { Types } from 'mongoose'

export interface IReordable {
  _id: Types.ObjectId
  order: number
}
