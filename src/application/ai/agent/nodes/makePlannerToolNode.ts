import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { SystemMessage } from '@langchain/core/messages'
import { initPlannerTools } from '../../tools/initPlannerTools.ts'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolResult } from '../../tools/helpers/ToolResult.ts'
import z, { ZodAny } from 'zod'

export const makePlannerToolNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const toolCalls = state.tool_calls || []
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      tool_calls: [],
      planner_has_error: false,
      planner_messages: [],
      current_plan: [],
      current_step_index: 0,
      final_response: '',
    }

    if (toolCalls.length === 0) {
      outputs.planner_messages!.push(new SystemMessage('You MUST call available tool.'))
      outputs.planner_has_error = true

      return outputs
    }

    if (toolCalls.length > 1) {
      outputs.planner_messages!.push(new SystemMessage('You MUST call only one tool.'))
      outputs.planner_has_error = true

      return outputs
    }

    const plannerTools = initPlannerTools()

    const toolByToolCalls: DynamicStructuredTool | undefined = plannerTools.find(
      (tool) => tool.name === toolCalls[0].name,
    )

    if (!toolByToolCalls) {
      outputs.planner_messages = [new SystemMessage(`Tool ${toolCalls[0].name} not found.`)]
      outputs.planner_has_error = true

      return outputs
    }

    const validationResult = (toolByToolCalls.schema as ZodAny).safeParse(toolCalls[0].args)

    if (!validationResult.success) {
      outputs.planner_messages = [
        new SystemMessage(
          `Validation Error: Invalid arguments. \n${z.prettifyError(
            validationResult.error,
          )}. \nPlease fix the arguments and try again.`,
        ),
      ]
      outputs.planner_has_error = true

      return outputs
    }

    try {
      const observation: ToolResult = await toolByToolCalls.invoke(toolCalls[0].args as any)

      if (!observation.success) {
        outputs.planner_messages = [
          new SystemMessage(`Error executing tool: ${observation.content}`),
        ]
        outputs.planner_has_error = true

        return outputs
      }

      if (toolCalls[0].name === 'execute_plan') {
        const plan = observation.content as string[]

        outputs.current_plan = plan
        outputs.current_step_index = 0
      } else if (toolCalls[0].name === 'response_to_user') {
        outputs.final_response = toolCalls[0].args.message
      }

      return outputs
    } catch (error) {
      outputs.planner_messages = [
        new SystemMessage(
          `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ]
      outputs.planner_has_error = true

      return outputs
    }
  }
}
