import { model, Schema } from 'mongoose'
import { IAgentSkillRaw } from '@entities/IAgentSkillRaw.ts'

const AgentSkillSchema = new Schema<IAgentSkillRaw>(
  {
    name: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    embeddings: {
      type: [Number],
      required: true,
      select: false,
    },
    description: {
      type: String,
      required: true,
    },
    related_tools: {
      type: [String],
      required: true,
    },
    related_entities: {
      type: [String],
      required: true,
    },
  },
  { timestamps: true },
)

const AgentSkill = model<IAgentSkillRaw>('AgentSkill', AgentSkillSchema)

export default AgentSkill
