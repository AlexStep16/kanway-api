import { Types } from 'mongoose'

export interface ICategoryCreatePayload {
  name: string
  workspace: Types.ObjectId
  board: Types.ObjectId
  userId: Types.ObjectId
  embeddings: Array<Number>
  order: number
  isDeleted?: boolean
  isDeletedExternal?: boolean
  deletedTime?: Date
}
