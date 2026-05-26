import { ToolCall } from '@langchain/core/messages'

export interface IConfigContext {
  isApproved?: boolean
  toolCall?: ToolCall
}
