import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { initPlannerTools } from '../../tools/initPlannerTools.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolResult } from '../../tools/helpers/ToolResult.js'
import z, { ZodAny } from 'zod'

export const makePlannerToolNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const toolCalls = state.tool_calls || []
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      tool_calls: [],
      planner_has_error: false,
      planner_messages: state.planner_messages,
      coder_messages: [],
      final_messages: state.final_messages,
      current_plan: [],
      current_payload: {},
      last_planner_tool_name: toolCalls.length === 1 ? toolCalls[0].name : '',
    }

    if (toolCalls.length > 1) {
      outputs.planner_messages!.push(new HumanMessage('You MUST call only one tool.'))
      outputs.planner_has_error = true

      return outputs
    }

    const plannerTools = initPlannerTools()

    const toolByToolCalls: DynamicStructuredTool | undefined = plannerTools.find(
      (tool) => tool.name === toolCalls[0].name,
    )

    if (!toolByToolCalls) {
      outputs.planner_messages!.push(new HumanMessage(`Tool ${toolCalls[0].name} not found.`))
      outputs.planner_has_error = true

      return outputs
    }

    const validationResult = (toolByToolCalls.schema as ZodAny).safeParse(toolCalls[0].args)

    if (!validationResult.success) {
      outputs.planner_messages!.push(
        new HumanMessage(
          `Validation Error: Invalid arguments. \n${z.prettifyError(
            validationResult.error,
          )}. \nPlease fix the arguments and try again.`,
        ),
      )
      outputs.planner_has_error = true

      return outputs
    }

    try {
      const observation: ToolResult = await toolByToolCalls.invoke(toolCalls[0].args as any)

      if (!observation.success) {
        outputs.planner_messages!.push(
          new HumanMessage(`Error executing tool: ${observation.content}`),
        )
        outputs.planner_has_error = true

        return outputs
      }

      if (toolCalls[0].name === 'execute_plan') {
        const { plan, payload } = observation.content as { plan: string[]; payload: any }

        outputs.current_plan = plan
        outputs.current_payload = payload || {}

        const beautifiedPlan = plan.map((step, index) => `${index + 1}. ${step}`).join('\n')

        const planMessage = new AIMessage(beautifiedPlan)

        outputs.final_messages!.push(planMessage)
        outputs.coder_messages!.push(planMessage)
      }

      return outputs
    } catch (error) {
      outputs.planner_messages!.push(
        new HumanMessage(
          `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      outputs.planner_has_error = true

      return outputs
    }
  }
}
