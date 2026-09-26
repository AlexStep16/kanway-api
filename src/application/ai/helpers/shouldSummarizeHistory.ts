import { BaseMessage, HumanMessage } from '@langchain/core/messages'

const DEFAULT_TURNS_THRESHOLD = 6

export function getHumanTurnsCount(messages: BaseMessage[]): number {
  if (!messages || messages.length === 0) return 0
  return messages.filter((msg) => HumanMessage.isInstance(msg)).length
}

export function shouldSummarizeHistory(
  messages: BaseMessage[],
  turnsThreshold: number = DEFAULT_TURNS_THRESHOLD,
): boolean {
  return getHumanTurnsCount(messages) >= turnsThreshold
}
