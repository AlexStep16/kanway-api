import { Types } from 'mongoose'

export interface ICategoryRaw {
  _id: Types.ObjectId
  name: string
  workspace_id: Types.ObjectId
  board_id: Types.ObjectId
  user_id: Types.ObjectId
  order: number
  embeddings: Array<Number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date
}
