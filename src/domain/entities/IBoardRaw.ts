import { Types } from 'mongoose'

export interface IBoardRaw {
  _id: Types.ObjectId
  name: string
  workspace: Types.ObjectId
  user_id: Types.ObjectId
  is_favorite: boolean
  tasks_count: number
  categories_count: number
  rank: string
  embeddings: Array<number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date | null
  createdAt: Date
  updatedAt: Date
}
