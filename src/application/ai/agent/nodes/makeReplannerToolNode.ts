import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolResult } from '../../tools/helpers/ToolResult.ts'
import z, { ZodAny } from 'zod'
import { initReplannerTools } from '../../tools/initReplannerTools.ts'
import { HumanMessage } from '@langchain/core/messages'

export const makeReplannerToolNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const toolCalls = state.tool_calls || []
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      tool_calls: [],
      replanner_has_error: false,
      replanner_messages: [],
      current_plan: state.current_plan,
      current_step_index: 0,
      current_payload: state.current_payload,
      last_replanner_tool_name: toolCalls.length === 1 ? toolCalls[0].name : '',
    }

    if (toolCalls.length > 1) {
      outputs.replanner_messages!.push(new HumanMessage('You MUST call only one tool.'))
      outputs.replanner_has_error = true

      return outputs
    }

    const replannerTools = initReplannerTools()

    const toolByToolCalls: DynamicStructuredTool | undefined = replannerTools.find(
      (tool) => tool.name === toolCalls[0].name,
    )

    if (!toolByToolCalls) {
      outputs.replanner_messages = [new HumanMessage(`Tool ${toolCalls[0].name} not found.`)]
      outputs.replanner_has_error = true

      return outputs
    }

    const validationResult = (toolByToolCalls.schema as ZodAny).safeParse(toolCalls[0].args)

    if (!validationResult.success) {
      outputs.replanner_messages = [
        new HumanMessage(
          `Validation Error: Invalid arguments. \n${z.prettifyError(
            validationResult.error,
          )}. \nPlease fix the arguments and try again.`,
        ),
      ]
      outputs.replanner_has_error = true

      return outputs
    }

    try {
      const observation: ToolResult = await toolByToolCalls.invoke(toolCalls[0].args as any)

      if (!observation.success) {
        outputs.replanner_messages = [
          new HumanMessage(`Error executing tool: ${observation.content}`),
        ]
        outputs.replanner_has_error = true

        return outputs
      }

      if (toolCalls[0].name === 'update_plan') {
        const { plan, payload } = observation.content as { plan: string[]; payload: any }

        outputs.current_plan = plan
        outputs.current_step_index = 0
        outputs.current_payload = payload || {}
      } else if (toolCalls[0].name === 'continue') {
        if (state.current_plan.length <= state.current_step_index + 1) {
          outputs.replanner_messages = [
            new HumanMessage(`No more steps in the current plan. You cannot continue.`),
          ]

          outputs.replanner_has_error = true

          return outputs
        }

        outputs.current_step_index = (state.current_step_index || 0) + 1
      }

      return outputs
    } catch (error) {
      outputs.replanner_messages = [
        new HumanMessage(
          `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ]
      outputs.replanner_has_error = true

      return outputs
    }
  }
}
