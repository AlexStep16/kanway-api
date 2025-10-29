import { model, Schema } from 'mongoose'
import { IWorkspace } from '@entities/IWorkspace.ts'
import { BASE_COLORS } from '@/constants/BASE_COLORS.ts'

export const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    is_favorite: {
      type: Boolean,
      default: false,
    },
    embeddings: {
      type: [Number],
      required: true,
    },
    order: {
      type: Number,
      default: 1,
    },
    deleted_time: {
      type: Date,
    },
    color: {
      type: String,
      enum: BASE_COLORS,
      default: '#191970',
    },
  },
  { timestamps: true }
)

const Workspace = model<IWorkspace>('Workspace', WorkspaceSchema)

export default Workspace
