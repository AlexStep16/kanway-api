import { Types } from 'mongoose'

export interface ICategory {
  id: Types.ObjectId
  name: string
  workspaceId: Types.ObjectId
  boardId: Types.ObjectId
  userId: Types.ObjectId
  order: number
  embeddings: Array<Number>
  isDeleted: boolean
  isDeletedExternal: boolean
  deletedTime?: Date
}
