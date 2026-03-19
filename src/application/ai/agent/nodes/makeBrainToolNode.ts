import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { SystemMessage } from '@langchain/core/messages'
import { initBrainTools } from '../../tools/initBrainTools.ts'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolResult } from '../../tools/helpers/ToolResult.ts'
import z, { ZodAny } from 'zod'

export const makeBrainToolNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const toolCalls = state.tool_calls || []
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      brain_messages: state.brain_messages,
      tool_calls: [],
      brain_has_error: false,
    }

    if (toolCalls.length === 0) {
      outputs.brain_messages!.push(
        new SystemMessage("You MUST call either 'resolve_query' or 'finish_response' tool."),
      )
      outputs.brain_has_error = true

      return outputs
    }

    if (toolCalls.length > 1) {
      outputs.brain_messages!.push(new SystemMessage('You MUST call only one tool.'))
      outputs.brain_has_error = true

      return outputs
    }

    const brainTools = initBrainTools()

    const toolByToolCalls: DynamicStructuredTool | undefined = brainTools.find(
      (tool) => tool.name === toolCalls[0].name,
    )

    if (!toolByToolCalls) {
      outputs.brain_messages = [new SystemMessage(`Tool ${toolCalls[0].name} not found.`)]
      outputs.brain_has_error = true

      return outputs
    }

    const validationResult = (toolByToolCalls.schema as ZodAny).safeParse(toolCalls[0].args)

    if (!validationResult.success) {
      outputs.brain_messages = [
        new SystemMessage(
          `Validation Error: Invalid arguments. \n${z.prettifyError(
            validationResult.error,
          )}. \nPlease fix the arguments and try again.`,
        ),
      ]
      outputs.brain_has_error = true

      return outputs
    }

    try {
      const observation: ToolResult = await toolByToolCalls.invoke(toolCalls[0].args as any)

      if (!observation.success) {
        outputs.brain_messages = [new SystemMessage(`Error executing tool: ${observation.content}`)]
        outputs.brain_has_error = true

        return outputs
      }

      outputs.enriched_message = observation.content

      return outputs
    } catch (error) {
      outputs.brain_messages = [
        new SystemMessage(
          `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ]
      outputs.brain_has_error = true

      return outputs
    }
  }
}
