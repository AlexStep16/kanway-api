import { Types } from 'mongoose'

export interface IChatMessageRaw {
  _id: Types.ObjectId
  role: 'user' | 'assistant' | 'preview'
  content: any
  chat_id: Types.ObjectId
  user_id: Types.ObjectId
  thread_id: string
  createdAt: Date
  updatedAt: Date
}
