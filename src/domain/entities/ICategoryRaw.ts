import { Types } from 'mongoose'

export interface ICategoryRaw {
  _id: Types.ObjectId
  name: string
  workspace_id: Types.ObjectId
  workspace_name: string
  board_id: Types.ObjectId
  board_name: string
  user_id: Types.ObjectId
  order: number
  embeddings: Array<Number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date
  createdAt: Date
  updatedAt: Date
}
