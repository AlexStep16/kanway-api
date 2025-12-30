import { model, Schema } from 'mongoose'
import { IAgentInstructionRaw } from '@entities/IAgentInstructionRaw.ts'

const AgentInstructionSchema = new Schema<IAgentInstructionRaw>(
  {
    topic: {
      type: String,
      required: true,
    },
    rule: {
      type: String,
      required: true,
    },
    embeddings: {
      type: [Number],
      required: true,
      select: false,
    },
    example: {
      type: String,
      required: true,
    },
    suggested_tools: {
      type: [String],
      required: true,
    },
  },
  { timestamps: true }
)

const AgentInstruction = model<IAgentInstructionRaw>('AgentInstruction', AgentInstructionSchema)

export default AgentInstruction
