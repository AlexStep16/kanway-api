import { Types } from 'mongoose'

export interface IAgentInstruction {
  id: Types.ObjectId
  topic: string
  example: string
  rule: string
  suggestedTools: string[]
  embeddings: number[]
  createdAt: Date
  updatedAt: Date
}
