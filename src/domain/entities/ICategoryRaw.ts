import { Types } from 'mongoose'

export interface ICategoryRaw {
  _id: Types.ObjectId
  name: string
  board_id: Types.ObjectId
  user_id: Types.ObjectId
  order: number
  embeddings: Array<Number>
  is_deleted: boolean
  deleted_time?: Date
}
