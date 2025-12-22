import { Types } from 'mongoose'

export interface IChatMessage {
  id: Types.ObjectId
  role: 'user' | 'assistant' | 'preview'
  content: any
  userId: Types.ObjectId
  chatId: Types.ObjectId
  threadId: string
  createdAt: Date
  updatedAt: Date
}
