import { Types } from 'mongoose'

export interface IAgentSkillRaw {
  _id: Types.ObjectId
  name: string
  description: string
  content: string
  related_tools: string[]
  related_entities: string[]
  embeddings: number[]
  createdAt: Date
  updatedAt: Date
}
