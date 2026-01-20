import { Types } from 'mongoose'

export interface IBoard<TWorkspace = Types.ObjectId> {
  id: Types.ObjectId
  name: string
  workspace: TWorkspace
  userId: Types.ObjectId
  isFavorite: boolean
  tasksCount: number
  categoriesCount: number
  order: number
  embeddings: number[]
  isDeleted: boolean
  isDeletedExternal: boolean
  deletedTime?: Date
  createdAt: Date
  updatedAt: Date
}
