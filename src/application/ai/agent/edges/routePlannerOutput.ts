import { AgentStateAnnotation } from '@application/ai/agent/AgentStateAnnotation.ts'
import { AIMessage, AIMessageChunk } from '@langchain/core/messages'

export const routePlannerOutput = (state: typeof AgentStateAnnotation.State) => {
  const lastMessage = state.messages.at(-1) as AIMessage | AIMessageChunk | undefined

  if (state.planner_has_error) {
    return 'planner'
  }

  const toolCalls = lastMessage?.tool_calls || []

  if (toolCalls.some((tc) => tc.name === 'finishResponse')) {
    return 'synthesize'
  }

  if (state.plan.length > 0) {
    return 'executor'
  }

  return 'chatbot'
}
