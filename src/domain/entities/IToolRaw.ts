import { Types } from 'mongoose'

export interface IToolRaw {
  _id: Types.ObjectId
  name: string
  description: string
  embeddings: number[]
  createdAt: Date
  updatedAt: Date
}
