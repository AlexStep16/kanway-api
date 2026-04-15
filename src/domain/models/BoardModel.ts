import { model, Schema } from 'mongoose'
import { IBoardRaw } from '@entities/IBoardRaw.ts'

export const BoardSchema = new Schema<IBoardRaw>(
  {
    name: {
      type: String,
      required: true,
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
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
    is_deleted_external: {
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
  },
  { timestamps: true },
)

const Board = model<IBoardRaw>('Board', BoardSchema)

export default Board
