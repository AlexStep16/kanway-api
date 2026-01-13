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
  embeddings: Array<Number>
  isDeleted: boolean
  isDeletedExternal: boolean
  deletedTime?: Date | null
  createdAt: Date
  updatedAt: Date
}
