import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { SystemMessage, ToolMessage } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolResult } from '../../tools/helpers/ToolResult.ts'
import { initSkillerTools } from '../../tools/initSkillerTools.ts'
import z, { ZodAny } from 'zod'

export const makeSkillerToolNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const toolCalls = state.tool_calls || []
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      skiller_messages: state.skiller_messages,
      skiller_has_error: false,
      related_skill_names: [],
    }

    if (toolCalls.length === 0) {
      outputs.skiller_messages!.push(new SystemMessage('You MUST call a tool.'))
      outputs.skiller_has_error = true

      return outputs
    }

    if (toolCalls.length > 1) {
      outputs.skiller_messages!.push(new SystemMessage('You MUST call only one tool.'))
      outputs.skiller_has_error = true

      return outputs
    }

    const skillerTools = initSkillerTools()

    const toolByToolCalls: DynamicStructuredTool | undefined = skillerTools.find(
      (tool) => tool.name === toolCalls[0].name,
    )

    if (!toolByToolCalls) {
      outputs.skiller_messages!.push(new SystemMessage(`Tool ${toolCalls[0].name} not found.`))
      outputs.skiller_has_error = true

      return outputs
    }

    const validationResult = (toolByToolCalls.schema as ZodAny).safeParse(toolCalls[0].args)

    if (!validationResult.success) {
      outputs.skiller_messages = [
        new SystemMessage(
          `Validation Error: Invalid arguments. \n${z.prettifyError(
            validationResult.error,
          )}. \nPlease fix the arguments and try again.`,
        ),
      ]
      outputs.skiller_has_error = true

      return outputs
    }

    const observation: ToolResult = await toolByToolCalls.invoke(toolCalls[0].args as any)

    if (!observation.success) {
      outputs.skiller_messages!.push(
        new SystemMessage(`Error executing tool: ${observation.content}`),
      )
      outputs.skiller_has_error = true

      return outputs
    }

    if (toolCalls[0].name === 'select_skills') {
      outputs.related_skill_names = observation.content as string[]

      return outputs
    }

    const result = new ToolMessage({
      tool_call_id: toolCalls[0].id!,
      name: toolCalls[0].name,
      content: observation.content,
    })

    outputs.skiller_messages = [result]

    return outputs
  }
}
