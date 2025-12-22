import { Types } from 'mongoose'

export interface ChatMessageDTO {
  role: 'user' | 'assistant' | 'preview'
  content: any
  threadId: string
  chatId: Types.ObjectId
  isResolved?: boolean
}
