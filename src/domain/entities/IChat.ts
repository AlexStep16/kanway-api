import { Types } from 'mongoose'

export interface IChat {
  id: Types.ObjectId
  userId: Types.ObjectId
  workspaceId: Types.ObjectId
  threadId: string
  name: string
  createdAt: Date
  updatedAt: Date
}
