import { model, Schema } from 'mongoose'
import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.js'
import { BASE_COLORS } from '@/constants/BASE_COLORS.js'

export const WorkspaceSchema = new Schema<IWorkspaceRaw>(
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
      select: false,
    },
    rank: {
      type: String,
      required: true,
    },
    deleted_time: {
      type: Date,
    },
    color: {
      type: String,
      enum: BASE_COLORS,
      default: '#3b82f6',
    },
    color_name: {
      type: String,
      default: 'Blue',
    },
  },
  { timestamps: true },
)

const Workspace = model<IWorkspaceRaw>('Workspace', WorkspaceSchema)

export default Workspace
