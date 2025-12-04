import { BaseMessageLike } from '@langchain/core/messages'
import { getLCMessageKind } from './getLCMessageKind.ts'

export function getLastIterationHistory(messages: any[]): BaseMessageLike[] {
  if (messages.length === 0) return []

  const newMessages: BaseMessageLike[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]

    newMessages.unshift(m)

    if (['human'].includes(getLCMessageKind(m))) {
      break
    }
  }

  return newMessages
}
