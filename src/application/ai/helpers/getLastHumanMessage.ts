import { BaseMessage, HumanMessage } from '@langchain/core/messages'

export default function getLastHumanMessage(messages: BaseMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m instanceof HumanMessage) {
      return m
    }
  }

  return null
}
