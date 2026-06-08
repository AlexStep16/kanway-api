import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'

export interface ITaskRawString {
  _id: string
  name: string
  workspace: string
  board: string
  column: string
  is_deleted: boolean
  is_deleted_external: boolean
  rank: string
  is_completed: boolean
  tags: Array<string>
  user_id: string
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
