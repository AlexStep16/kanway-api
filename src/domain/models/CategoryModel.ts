import { model, Schema } from 'mongoose'
import { ICategoryRaw } from '@entities/ICategoryRaw.js'

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

const Category = model<ICategoryRaw>('Category', CategorySchema)

export default Category
