import { Types } from 'mongoose'

export interface ICategory<TBoard = Types.ObjectId, TWorkspace = Types.ObjectId> {
  id: Types.ObjectId
  name: string
  workspace: TWorkspace
  board: TBoard
  userId: Types.ObjectId
  tasksCount: number
  order: number
  embeddings: Array<number>
  isDeleted: boolean
  isDeletedExternal: boolean
  deletedTime?: Date
  tempClientId?: string
  createdAt: Date
  updatedAt: Date
}
