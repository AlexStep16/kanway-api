import { Types } from 'mongoose'
import { TASK_COLORS } from '@constants/TASK_COLORS.ts'

export interface ITask<
  TBoard = Types.ObjectId,
  TCategory = Types.ObjectId,
  TWorkspace = Types.ObjectId
> {
  id: Types.ObjectId
  name: string
  workspace: TWorkspace
  board: TBoard
  category: TCategory
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
  color?: (typeof TASK_COLORS)[number]
  colorName?: string
  embeddings?: number[]
  tempClientId?: string
  createdAt: Date
  updatedAt: Date
}
