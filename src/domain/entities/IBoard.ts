import { Types } from 'mongoose'

export interface IBoard {
  id: Types.ObjectId
  name: string
  workspaceId: Types.ObjectId
  workspaceName: string
  userId: Types.ObjectId
  isFavorite: boolean
  order: number
  embeddings: Array<Number>
  isDeleted: boolean
  isDeletedExternal: boolean
  deletedTime?: Date
  createdAt: Date
  updatedAt: Date
}
