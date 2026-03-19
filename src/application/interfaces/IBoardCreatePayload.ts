import { Types } from 'mongoose'

export interface IBoardCreatePayload {
  id?: string
  name: string
  workspace: Types.ObjectId
  userId: Types.ObjectId
  embeddings: Array<number>
  rank: string
  isFavorite?: boolean
  isDeleted?: boolean
  isDeletedExternal?: boolean
  deletedTime?: Date
}
