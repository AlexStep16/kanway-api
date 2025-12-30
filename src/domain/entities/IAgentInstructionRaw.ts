import { Types } from 'mongoose'

export interface IAgentInstructionRaw {
  _id: Types.ObjectId
  topic: string
  example: string
  rule: string
  suggested_tools: string[]
  embeddings: number[]
  createdAt: Date
  updatedAt: Date
}
