import { Types } from 'mongoose'

export interface ICategoryCreatePayload {
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
