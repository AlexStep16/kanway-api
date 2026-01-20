import { Types } from 'mongoose'

export interface IBoardCreatePayload {
  name: string
  workspace: Types.ObjectId
  userId: Types.ObjectId
  embeddings: Array<Number>
  order: number
  isFavorite?: boolean
  isDeleted?: boolean
  isDeletedExternal?: boolean
  deletedTime?: Date
}
