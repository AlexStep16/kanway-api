import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { AIMessage, AIMessageChunk } from '@langchain/core/messages'

export const routeExecutorOutput = (state: typeof AgentStateAnnotation.State) => {
  const lastMessage = state.executor_messages.at(-1)

  if (
    !lastMessage ||
    !(lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk)
  ) {
    return 'synthesize'
  }

  const toolCalls = lastMessage.tool_calls || []

  if (toolCalls.some((tc) => tc.name === 'getRelevantTools')) {
    return 'retrieve'
  }

  if (toolCalls.some((tc) => tc.name === 'responseToUser')) {
    return 'synthesize'
  }

  if (toolCalls.length > 0) {
    return 'verify'
  }

  return 'synthesize'
}
