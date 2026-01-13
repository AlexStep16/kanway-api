import { Types } from 'mongoose'

export interface IReordable {
  id: Types.ObjectId
  order: number
}
