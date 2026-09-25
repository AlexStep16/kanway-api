import { BaseMessage, HumanMessage } from '@langchain/core/messages'

const PREVIOUS_TURNS_TO_KEEP = 2

export default function getOrchestratorHistory(messages: BaseMessage[]): BaseMessage[] {
  if (!messages || messages.length === 0) return []

  const humanIndices: number[] = []
  messages.forEach((msg, index) => {
    if (HumanMessage.isInstance(msg)) {
      humanIndices.push(index)
    }
  })

  if (humanIndices.length === 0) return messages

  const targetHumanIndexPosition = Math.max(0, humanIndices.length - 1 - PREVIOUS_TURNS_TO_KEEP)
  const startIndex = humanIndices[targetHumanIndexPosition]

  return messages.slice(startIndex)
}
