import { Types } from 'mongoose'

export interface IChatRaw {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  workspace_id: Types.ObjectId
  thread_id: string
  name: string
  createdAt: Date
  updatedAt: Date
}
