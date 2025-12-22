import { Types } from 'mongoose'

export interface ITool {
  id: Types.ObjectId
  name: string
  description: string
  embeddings: number[]
  createdAt: Date
  updatedAt: Date
}
