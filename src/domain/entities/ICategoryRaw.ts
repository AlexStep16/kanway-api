import { Types } from 'mongoose'

export interface IColumnRaw {
  _id: Types.ObjectId
  name: string
  workspace: Types.ObjectId
  board: Types.ObjectId
  user_id: Types.ObjectId
  rank: string
  embeddings: Array<number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date | null
  createdAt: Date
  updatedAt: Date
}
