import { BaseMessage } from '@langchain/core/messages'
import getLastHumanMessage from './getLastHumanMessage.js'

const HISTORY_LIMIT = 10

export default function getOrchestratorHistory(messages: BaseMessage[]) {
  const history: BaseMessage[] = []

  const lastHumanMessage = getLastHumanMessage(messages)

  if (lastHumanMessage) {
    const lastHumanMessageIndex = messages.indexOf(lastHumanMessage)

    history.push(...messages.slice(Math.max(0, lastHumanMessageIndex - HISTORY_LIMIT)))
  }

  return history
}
