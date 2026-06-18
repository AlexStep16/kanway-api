import { Types } from 'mongoose'
import { IChatMessageRoles } from '@application/interfaces/IChatMessageRoles.js'

export interface ChatMessageDTO {
  role: IChatMessageRoles
  content: any
  iterationId: string
  listType?: string
  pendingToolCallId?: string
  threadId: string
  creditsUsed?: number
  audioCreditsUsed?: number
  rating?: boolean
  chatId: Types.ObjectId
  isResolved?: boolean
}
