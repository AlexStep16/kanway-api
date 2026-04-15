import { Types } from 'mongoose'
import { TASK_COLORS_TITLES } from '@constants/TASK_COLORS.js'

export interface ITaskCreatePayload {
  id?: string
  name: string
  workspace: Types.ObjectId
  board: Types.ObjectId
  category: Types.ObjectId
  userId: Types.ObjectId
  rank: string
  tags: Array<string>
  embeddings: number[]
  isCompleted?: boolean
  isDeleted?: boolean
  isDeletedExternal?: boolean
  deletedTime?: Date | null
  description?: string
  dueDate?: string
  dueHours?: number
  dueMinutes?: number
  color?: {
    value: (typeof TASK_COLORS_TITLES)[number]
    tone: 'light' | 'medium' | 'dark'
  }
  tempClientId?: string
}
