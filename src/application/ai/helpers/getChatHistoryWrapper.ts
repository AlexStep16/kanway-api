import { ToolMessage } from '@langchain/core/messages'
import { getChatHistory } from './getChatHistory.ts'

export function getChatHistoryWrapper(messages: any[]) {
  const lastMessage: any = messages[messages.length - 1]
  const getChatHistoryCall = lastMessage.tool_calls.find(
    (call: any) => call.name === 'getChatHistory'
  )

  const chatHistory = getChatHistory(getChatHistoryCall.args, messages)

  return new ToolMessage({
    content: chatHistory,
    tool_call_id: getChatHistoryCall.id,
  })
}
