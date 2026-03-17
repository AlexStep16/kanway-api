import { Types } from 'mongoose'

export interface IAgentSkill {
  id: Types.ObjectId
  name: string
  description: string
  content: string
  relatedTools: string[]
  relatedEntities: string[]
  embeddings: number[]
  createdAt: Date
  updatedAt: Date
}
