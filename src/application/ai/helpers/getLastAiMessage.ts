import { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages'

export default function getLastAiMessage(messages: BaseMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m instanceof AIMessage || m instanceof AIMessageChunk) {
      return m
    }
  }

  return null
}
