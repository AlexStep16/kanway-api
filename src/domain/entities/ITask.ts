import { Types } from 'mongoose'
import { TASK_COLORS_TITLES } from '@constants/TASK_COLORS.js'

export interface ITask<
  TBoard = Types.ObjectId,
  TCategory = Types.ObjectId,
  TWorkspace = Types.ObjectId,
> {
  id: Types.ObjectId
  name: string
  workspace: TWorkspace
  board: TBoard
  category: TCategory
  isDeleted: boolean
  isDeletedExternal: boolean
  rank: string
  isCompleted: boolean
  tags: Array<string>
  userId: Types.ObjectId
  deletedTime?: Date
  description?: string
  dueDate?: string
  dueHours?: number
  dueMinutes?: number
  color?: {
    value: (typeof TASK_COLORS_TITLES)[number]
    tone: 'light' | 'medium' | 'dark'
  }
  embeddings?: number[]
  tempClientId?: string
  createdAt: Date
  updatedAt: Date
}
