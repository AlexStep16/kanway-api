import { BaseMessage, HumanMessage } from '@langchain/core/messages'

export function getLastIterationHistory(messages: any[]): BaseMessage[] {
  if (messages.length === 0) return []

  const newMessages: BaseMessage[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]

    newMessages.unshift(m)

    if (m instanceof HumanMessage) {
      break
    }
  }

  return newMessages
}
