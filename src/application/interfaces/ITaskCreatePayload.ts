import { Types } from 'mongoose'
import { TASK_COLORS } from '@constants/TASK_COLORS.ts'

export interface ITaskCreatePayload {
  name: string
  workspace: Types.ObjectId
  board: Types.ObjectId
  category: Types.ObjectId
  userId: Types.ObjectId
  order: number
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
  color?: (typeof TASK_COLORS)[number]
  colorName?: string
  tempClientId?: string
}
