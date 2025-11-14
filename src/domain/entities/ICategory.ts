import { Types } from 'mongoose'

export interface ICategory {
  id: Types.ObjectId
  name: string
  workspaceId: Types.ObjectId
  workspaceName: string
  boardId: Types.ObjectId
  boardName: string
  userId: Types.ObjectId
  order: number
  embeddings: Array<Number>
  isDeleted: boolean
  isDeletedExternal: boolean
  deletedTime?: Date
  createdAt: Date
  updatedAt: Date
}
