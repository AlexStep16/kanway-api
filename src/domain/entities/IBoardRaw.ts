import { Types } from 'mongoose'

export interface IBoardRaw {
  _id: Types.ObjectId
  name: string
  workspace_id: Types.ObjectId
  workspace_name: string
  user_id: Types.ObjectId
  is_favorite: boolean
  order: number
  embeddings: Array<Number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date
  created_at: Date
  updated_at: Date
}
