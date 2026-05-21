import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage } from '@langchain/core/messages'

export function getTextHistory(messages: BaseMessage[]) {
  const textHistory = []

  for (const msg of messages) {
    if (msg instanceof HumanMessage) {
      textHistory.push(`User:\n${msg.text}\n----------------`)
    } else if (msg instanceof AIMessage || msg instanceof AIMessageChunk) {
      textHistory.push(`AI:\n${msg.text}\n----------------`)
    }
  }

  return textHistory.join('\n')
}
