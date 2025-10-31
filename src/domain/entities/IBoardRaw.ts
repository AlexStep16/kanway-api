import { Types } from 'mongoose'

export interface IBoardRaw {
  _id: Types.ObjectId
  name: string
  workspace_id: Types.ObjectId
  user_id: Types.ObjectId
  is_favorite: boolean
  order: number
  embeddings: Array<Number>
  is_deleted: boolean
  deleted_time?: Date
}
