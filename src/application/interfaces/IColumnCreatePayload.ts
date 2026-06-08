import { Types } from 'mongoose'

export interface IColumnCreatePayload {
  id?: string
  name: string
  workspace: Types.ObjectId
  board: Types.ObjectId
  userId: Types.ObjectId
  embeddings: Array<number>
  rank: string
  isDeleted?: boolean
  isDeletedExternal?: boolean
  deletedTime?: Date
}
