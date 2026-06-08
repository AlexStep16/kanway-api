import { model, Schema } from 'mongoose'
import { ITaskRaw } from '@entities/ITaskRaw.js'
import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'

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
    column: {
      type: Schema.Types.ObjectId,
      ref: 'Column',
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
    rank: {
      type: String,
      required: true,
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
      type: {
        value: {
          type: String,
          enum: TASK_COLORS_TITLES,
        },
        tone: {
          type: String,
          enum: ['light', 'medium', 'dark'],
        },
      },
    },
    deleted_time: {
      type: Date,
    },
  },
  { timestamps: true },
)

const Task = model<ITaskRaw>('Task', TaskSchema)

export default Task
