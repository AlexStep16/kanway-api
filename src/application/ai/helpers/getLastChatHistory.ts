import { BaseMessageLike } from '@langchain/core/messages'
import { getLCMessageKind } from './getLCMessageKind.ts'

export function getLastChatHistory(messages: any[], count: number = 10): BaseMessageLike[] {
  if (messages.length === 0) return []

  const newMessages: BaseMessageLike[] = []
  let counter = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    const content = m.content || m.kwargs?.content || ''

    newMessages.unshift(m)

    if (['human', 'ai'].includes(getLCMessageKind(m)) && content && i !== messages.length - 1) {
      counter++
    }

    if (counter >= count) {
      break
    }
  }

  return newMessages
}
