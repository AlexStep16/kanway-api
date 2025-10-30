import { model, Schema } from 'mongoose'
import { IBoard } from '@entities/IBoard.ts'

export const BoardSchema = new Schema<IBoard>(
  {
    name: {
      type: String,
      required: true,
    },
    workspace_id: {
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
    is_favorite: {
      type: Boolean,
      default: false,
    },
    embeddings: {
      type: [Number],
      required: true,
      select: false,
    },
    order: {
      type: Number,
      default: 1,
    },
    deleted_time: {
      type: Date,
    },
  },
  { timestamps: true }
)

const Board = model<IBoard>('Board', BoardSchema)

export default Board
