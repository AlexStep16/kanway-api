import { Types } from 'mongoose'
import { IChatMessageRoles } from '@application/interfaces/IChatMessageRoles.js'

export interface ChatMessageDTO {
  role: IChatMessageRoles
  content: any
  listType?: string
  pendingToolCallId?: string
  threadId: string
  creditsUsed?: number
  rating?: boolean
  chatId: Types.ObjectId
  isResolved?: boolean
}
