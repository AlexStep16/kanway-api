import { model, Schema } from 'mongoose'
import { IColumnRaw } from '@entities/IColumnRaw.js'

export const ColumnSchema = new Schema<IColumnRaw>(
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
    board: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
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

const Column = model<IColumnRaw>('Column', ColumnSchema)

export default Column
