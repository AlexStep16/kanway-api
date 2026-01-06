import { HumanMessage } from '@langchain/core/messages'

export function getLastHumanContent(messages: any[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]

    if (m instanceof HumanMessage) {
      return typeof m.content === 'string' ? m.content : undefined
    }
  }
  return undefined
}
