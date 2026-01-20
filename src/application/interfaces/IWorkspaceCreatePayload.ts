import { Types } from 'mongoose'

export interface IWorkspaceCreatePayload {
  name: string
  userId: Types.ObjectId
  embeddings: Array<Number>
  color: string
  colorName: string
  order: number
  isFavorite?: boolean
  isDeleted?: boolean
  isDeletedExternal?: boolean
  deletedTime?: Date
}
