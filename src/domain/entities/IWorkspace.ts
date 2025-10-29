import { Types } from 'mongoose'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

export interface IWorkspace {
  _id: Types.ObjectId
  name: string
  user_id: Types.ObjectId
  is_favorite: boolean
  order: number
  color: (typeof BASE_COLORS)[number]
  embeddings: Array<Number>
  is_deleted: boolean
  deleted_time?: Date
}
