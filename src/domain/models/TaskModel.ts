import { model, Schema } from 'mongoose'
import { ITaskRaw } from '@entities/ITaskRaw.ts'

export const TaskSchema = new Schema<ITaskRaw>(
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
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    embeddings: {
      type: [Number],
      required: true,
      select: false,
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
    order: {
      type: Number,
      default: 1,
    },
    is_completed: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
    },
    due_date: {
      type: String,
    },
    due_hours: {
      type: Number,
    },
    due_minutes: {
      type: Number,
    },
    color: {
      type: String,
    },
    color_name: {
      type: String,
    },
    deleted_time: {
      type: Date,
    },
  },
  { timestamps: true }
)

const Task = model<ITaskRaw>('Task', TaskSchema)

export default Task
