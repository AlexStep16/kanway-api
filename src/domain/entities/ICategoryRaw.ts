import { Types } from 'mongoose'

export interface ICategoryRaw {
  _id: Types.ObjectId
  name: string
  workspace: Types.ObjectId
  board: Types.ObjectId
  user_id: Types.ObjectId
  tasks_count: number
  order: number
  embeddings: Array<Number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date | null
  createdAt: Date
  updatedAt: Date
}
