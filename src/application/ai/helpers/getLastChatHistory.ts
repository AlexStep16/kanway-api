import { BaseMessage, ToolMessage } from '@langchain/core/messages'

export function getLastChatHistory(messages: BaseMessage[], count: number = 10): BaseMessage[] {
  if (messages.length === 0) return []

  const newMessages: BaseMessage[] = []
  let counter = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]

    newMessages.unshift(m)
    counter++

    if (counter >= count && !(m instanceof ToolMessage)) {
      break
    }
  }

  return newMessages
}
