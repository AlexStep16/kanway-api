import { StatusLog } from '@/application/types/StatusLog.js'
import { ToolCall } from '@langchain/core/messages'

export interface IConfigContext {
  isApproved?: boolean
  toolCall?: ToolCall
  statusLog?: StatusLog
}
