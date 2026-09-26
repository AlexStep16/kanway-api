import { BaseMessage, HumanMessage } from '@langchain/core/messages'

const PREVIOUS_TURNS_TO_KEEP = Infinity

export default function getHistoryTurns(
  messages: BaseMessage[],
  isFirstTurns = false,
  turnsToKeep = PREVIOUS_TURNS_TO_KEEP,
): BaseMessage[] {
  if (!messages || messages.length === 0) return []

  const humanIndices: number[] = []
  messages.forEach((msg, index) => {
    if (HumanMessage.isInstance(msg)) {
      humanIndices.push(index)
    }
  })

  if (humanIndices.length === 0) return messages

  const targetHumanIndexPosition = Math.max(0, humanIndices.length - 1 - turnsToKeep)
  const startIndex = humanIndices[targetHumanIndexPosition]

  return isFirstTurns ? messages.slice(0, startIndex) : messages.slice(startIndex)
}
