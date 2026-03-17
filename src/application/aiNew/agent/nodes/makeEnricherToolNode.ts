import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/aiNew/agent/AgentStateAnnotation.ts'
import { RemoveMessage, SystemMessage } from '@langchain/core/messages'
import { initEnricherTools } from '../../tools/initEnricherTools.ts'
import { initHotTools } from '../../tools/initHotTools.ts'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolResult } from '../../tools/helpers/ToolResult.ts'

export const makeEnricherToolNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const toolCalls = state.tool_calls || []
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],
      tool_calls: [],
      enricher_has_error: false,
    }

    if (toolCalls.length === 0) {
      outputs.messages = [new SystemMessage("You MUST call a 'resolve_query' tool.")]
      outputs.enricher_has_error = true

      return outputs
    }

    if (toolCalls.length > 1) {
      outputs.messages = [new SystemMessage('You MUST call only one tool.')]
      outputs.enricher_has_error = true

      return outputs
    }

    outputs.messages?.push(
      new RemoveMessage({
        id: state.messages.at(-1)?.id || '',
      }),
    )

    if (toolCalls[0].name !== 'resolve_query') {
      outputs.messages = [new SystemMessage("The only tool you can call is 'resolve_query'.")]
      outputs.enricher_has_error = true

      return outputs
    }

    const hotTools = initHotTools()
    const enticherTools = initEnricherTools()
    const allTools = [...hotTools, ...enticherTools]

    const toolByToolCalls: DynamicStructuredTool | undefined = allTools.find(
      (tool) => tool.name === toolCalls[0].name,
    )

    if (!toolByToolCalls) {
      outputs.messages = [new SystemMessage(`Tool ${toolCalls[0].name} not found.`)]
      outputs.enricher_has_error = true

      return outputs
    }

    const observation: ToolResult = await toolByToolCalls.invoke(toolCalls[0].args as any)

    if (!observation.success) {
      outputs.messages = [new SystemMessage(`Error executing tool: ${observation.content}`)]
      outputs.enricher_has_error = true

      return outputs
    }

    outputs.enriched_message = observation.content

    return outputs
  }
}
