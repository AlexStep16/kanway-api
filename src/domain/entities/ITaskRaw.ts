import { Types } from 'mongoose'

export interface ITaskRaw {
  _id: Types.ObjectId
  name: string
  workspace_id: Types.ObjectId
  board_id: Types.ObjectId
  category_id: Types.ObjectId
  is_deleted: boolean
  is_deleted_external: boolean
  order: number
  is_completed: boolean
  tags: Array<string>
  user_id: Types.ObjectId
  embeddings: Array<Number>
  deleted_time?: Date
  description?: string
  due_date?: string
  due_hours?: number
  due_minutes?: number
  color?: string
  color_name?: string
}
