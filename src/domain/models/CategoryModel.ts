import { model, Schema } from 'mongoose'
import { ICategoryRaw } from '@entities/ICategoryRaw.ts'

export const CategorySchema = new Schema<ICategoryRaw>(
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
    workspace_name: {
      type: String,
      required: true,
    },
    board_id: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
    },
    board_name: {
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
    is_deleted_external: {
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

const Category = model<ICategoryRaw>('Category', CategorySchema)

export default Category
