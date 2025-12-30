import { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages'

export function getLastAIToolCallsMessage(messages: BaseMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]

    if (
      (message instanceof AIMessage || message instanceof AIMessageChunk) &&
      message.tool_calls &&
      message.tool_calls.length > 0
    ) {
      return message
    }
  }

  return null
}
