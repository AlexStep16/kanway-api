import { Types } from 'mongoose'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

export interface IWorkspaceRaw {
  _id: Types.ObjectId
  name: string
  user_id: Types.ObjectId
  is_favorite: boolean
  tasks_count: number
  categories_count: number
  boards_count: number
  order: number
  color: (typeof BASE_COLORS)[number]
  color_name: string
  embeddings: Array<Number>
  is_deleted: boolean
  deleted_time?: Date | null
  createdAt: Date
  updatedAt: Date
}
