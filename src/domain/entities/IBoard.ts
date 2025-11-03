import { Types } from 'mongoose'

export interface IBoard {
  id: Types.ObjectId
  name: string
  workspaceId: Types.ObjectId
  userId: Types.ObjectId
  isFavorite: boolean
  order: number
  embeddings: Array<Number>
  isDeleted: boolean
  isDeletedExternal: boolean
  deletedTime?: Date
}
