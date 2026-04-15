import { IChatMessageRoles } from '../IChatMessageRoles.js'
import { IBaseCriteria } from './IBaseCriteria.js'

export interface IChatMessageCriteria extends IBaseCriteria {
  chatId?: string
  chatIds?: string[]

  threadId?: string
  threadIds?: string[]

  role?: IChatMessageRoles
  roles?: IChatMessageRoles[]

  pendingToolCallId?: string
  pendingToolCallIds?: string[]
}
