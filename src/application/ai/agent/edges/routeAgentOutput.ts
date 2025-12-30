import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { getLastAIToolCallsMessage } from '../../helpers/getLastAIToolCallsMessage.ts'

export const routeAgentOutput = (state: typeof AgentStateAnnotation.State) => {
  const lastMessage = getLastAIToolCallsMessage(state.messages)

  if (!lastMessage) {
    return 'synthesize'
  }

  const toolCalls = lastMessage.tool_calls || []

  // Если нет тулов или это спец-тул завершения -> СИНТЕЗ
  if (toolCalls.length === 0 || toolCalls.some((tc) => tc.name === 'finishResponse')) {
    return 'synthesize'
  }

  // Если агент хочет найти новые тулы -> ПОИСК
  if (toolCalls.some((tc) => tc.name === 'getRelevantTools')) {
    return 'retrieve'
  }

  // В остальных случаях (обычные тулы) -> ПРОВЕРКА
  return 'verify'
}
