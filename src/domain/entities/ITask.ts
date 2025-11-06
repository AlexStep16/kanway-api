import { Types } from 'mongoose'

export interface ITask {
  id: Types.ObjectId
  name: string
  workspaceId: Types.ObjectId
  boardId: Types.ObjectId
  categoryId: Types.ObjectId
  isDeleted: boolean
  isDeletedExternal: boolean
  order: number
  isCompleted: boolean
  tags: Array<string>
  userId: Types.ObjectId
  deletedTime?: Date
  description?: string
  dueDate?: string
  dueHours?: number
  dueMinutes?: number
  color?: string
  colorName?: string
}
