import { Types } from 'mongoose'
import { BASE_COLORS } from '@constants/BASE_COLORS.js'

export interface IWorkspaceRaw {
  _id: Types.ObjectId
  name: string
  user_id: Types.ObjectId
  is_favorite: boolean
  rank: string
  color: (typeof BASE_COLORS)[number]
  color_name: string
  embeddings: Array<number>
  is_deleted: boolean
  deleted_time?: Date | null
  createdAt: Date
  updatedAt: Date
}
