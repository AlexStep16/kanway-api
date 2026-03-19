import { Types } from 'mongoose'

export interface IWorkspaceCreatePayload {
  id?: string
  name: string
  userId: Types.ObjectId
  embeddings: Array<number>
  color: string
  colorName: string
  rank: string
  isFavorite?: boolean
  isDeleted?: boolean
  isDeletedExternal?: boolean
  deletedTime?: Date
}
