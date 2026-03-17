import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/aiNew/agent/AgentStateAnnotation.ts'
import { SystemMessage, ToolMessage } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolResult } from '../../tools/helpers/ToolResult.ts'
import { initSkillerTools } from '../../tools/initSkillerTools.ts'

export const makeSkillerToolNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const toolCalls = state.tool_calls || []

    if (toolCalls.length === 0) {
      return {
        skiller_messages: new SystemMessage('You MUST call a tool.'),
        skiller_has_error: true,
      }
    }

    if (toolCalls.length > 1) {
      return {
        skiller_messages: new SystemMessage('You MUST call only one tool.'),
        skiller_has_error: true,
      }
    }

    const skillerTools = initSkillerTools()

    const toolByToolCalls: DynamicStructuredTool | undefined = skillerTools.find(
      (tool) => tool.name === toolCalls[0].name,
    )

    if (!toolByToolCalls) {
      return {
        skiller_messages: new SystemMessage(`Tool ${toolCalls[0].name} not found.`),
        skiller_has_error: true,
      }
    }

    const observation: ToolResult = await toolByToolCalls.invoke(toolCalls[0].args as any)

    if (!observation.success) {
      return {
        skiller_messages: new SystemMessage(`Error executing tool: ${observation.errorMsg}`),
        skiller_has_error: true,
      }
    }

    if (toolCalls[0].name === 'select_skills') {
      return {
        related_skill_names: observation.content,
        skiller_has_error: false,
      }
    }

    const result = new ToolMessage({
      tool_call_id: toolCalls[0].id!,
      name: toolCalls[0].name,
      content: observation.content,
    })

    return {
      skiller_messages: [result],
      skiller_has_error: false,
    }
  }
}
