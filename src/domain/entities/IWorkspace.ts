import { Types } from 'mongoose'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

export interface IWorkspace {
  id: Types.ObjectId
  name: string
  userId: Types.ObjectId
  isFavorite: boolean
  rank: string
  color: (typeof BASE_COLORS)[number]
  colorName: string
  embeddings: Array<number>
  isDeleted: boolean
  deletedTime?: Date
  createdAt: Date
  updatedAt: Date
}
