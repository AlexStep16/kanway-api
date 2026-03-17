import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.ts'
import { Types } from 'mongoose'

export interface ITaskRaw {
  _id: Types.ObjectId
  name: string
  workspace: Types.ObjectId
  board: Types.ObjectId
  category: Types.ObjectId
  is_deleted: boolean
  is_deleted_external: boolean
  order: number
  is_completed: boolean
  tags: Array<string>
  user_id: Types.ObjectId
  embeddings: Array<number>
  deleted_time?: Date | null
  description?: string
  due_date?: string
  due_hours?: number
  due_minutes?: number
  color?: {
    value: (typeof TASK_COLORS_TITLES)[number]
    tone: 'light' | 'medium' | 'dark'
  }
  createdAt: Date
  updatedAt: Date
}
