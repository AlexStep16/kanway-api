import { model, Schema } from 'mongoose'
import { ICategoryRaw } from '@entities/ICategoryRaw.ts'

export const CategorySchema = new Schema<ICategoryRaw>(
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
    tasks_count: {
      type: Number,
      default: 0,
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
