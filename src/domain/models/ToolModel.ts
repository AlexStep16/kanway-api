import { model, Schema } from 'mongoose'
import { IToolRaw } from '@entities/IToolRaw.js'

const ToolSchema = new Schema<IToolRaw>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    embeddings: {
      type: [Number],
      required: true,
      select: false,
    },
  },
  { timestamps: true },
)

const Tool = model<IToolRaw>('Tool', ToolSchema)

export default Tool
