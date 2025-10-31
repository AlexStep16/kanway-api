import { Types } from 'mongoose'

export interface ICategory {
  id: Types.ObjectId
  name: string
  boardId: Types.ObjectId
  userId: Types.ObjectId
  order: number
  embeddings: Array<Number>
  isDeleted: boolean
  deletedTime?: Date
}
