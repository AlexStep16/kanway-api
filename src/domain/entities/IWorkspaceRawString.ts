import { BASE_COLORS } from '@constants/BASE_COLORS.js'

export interface IWorkspaceRawString {
  _id: string
  name: string
  user_id: string
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
