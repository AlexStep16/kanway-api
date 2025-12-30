import { AgentDependencies } from '@application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@application/ai/agent/AgentStateAnnotation.ts'
import { AIMessage, RemoveMessage, ToolCall } from '@langchain/core/messages'
import { getLastAIToolCallsMessage } from '@application/ai/helpers/getLastAIToolCallsMessage.ts'

export const makeToolsRetrievalNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State) => {
    const { toolExecutorService } = deps.services

    const lastMessage: AIMessage | null = getLastAIToolCallsMessage(state.messages)
    const toolCalls: ToolCall[] = lastMessage?.tool_calls || []

    const toolCall = toolCalls.find((tc) => tc.name === 'getRelevantTools')

    if (!toolCall) return {}

    const { relevantNames } = await toolExecutorService.getRelevantTools(toolCall.args.steps)

    for (const name of relevantNames) {
      if (!state.relevant_tools.includes(name)) {
        state.relevant_tools.push(name)
      }
    }

    return {
      messages: [
        new RemoveMessage({
          id: lastMessage?.id || '',
        }),
      ],
    }
  }
}
