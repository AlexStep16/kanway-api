import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolCall, ToolMessage } from '@langchain/core/messages'
import z, { ZodAny } from 'zod'
import { ToolResult } from '../../tools/helpers/ToolResult.js'
import { initTaskManagerTools } from '../../tools/initTaskManagerTools.js'
import { AgentDependencies } from '../types/AgentDependencies.js'
import { IToolResultMeta } from '../../interfaces/IToolResultMeta.js'

async function executeToolCall(toolCall: ToolCall, orchestratorTools: DynamicStructuredTool[]) {
  const toolByToolCalls: DynamicStructuredTool | undefined = orchestratorTools.find(
    (tool) => tool.name === toolCall.name,
  )

  if (!toolByToolCalls) {
    throw new ToolMessage(`Tool ${toolCall.name} not found.`, toolCall.id!)
  }

  const validationResult = (toolByToolCalls.schema as ZodAny).safeParse(toolCall.args)

  if (!validationResult.success) {
    throw new ToolMessage(
      `Validation Error: Invalid arguments. \n${z.prettifyError(
        validationResult.error,
      )}. \nPlease fix the arguments and try again.`,
      toolCall.id!,
    )
  }

  try {
    const observation: ToolResult = await toolByToolCalls.invoke(toolCall.args as any)

    if (!observation.success) {
      throw new ToolMessage(
        `Tool ${toolCall.name} execution failed. Observation: ${observation.content}`,
        toolCall.id!,
      )
    }

    return {
      message: new ToolMessage(JSON.stringify(observation.content), toolCall.id!),
      meta: observation.meta,
    }
  } catch (error) {
    throw new ToolMessage(
      `Tool ${toolCall.name} execution error: ${(error as Error).message}`,
      toolCall.id!,
    )
  }
}

export const makeTaskManagerAgentToolNode = (dependencies: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotationOrc.State, config: RunnableConfig) => {
    const toolCalls = state.task_manager_tool_calls || []

    const outputs: Partial<typeof AgentStateAnnotationOrc.State> = {
      messages: [],
      task_manager_messages: state.task_manager_messages,
      task_manager_tool_results: [],
      task_manager_has_error: false,
      active_selections: state.active_selections,
    }

    const taskManagerTools = initTaskManagerTools(dependencies, config)
    const lastCallManagerTool = state.orchestrator_tool_calls
      .reverse()
      .find((call) => call.name === 'call_task_manager_agent')

    const toolExecutions: Promise<{
      message: ToolMessage
      meta: IToolResultMeta | null
    }>[] = []

    for (const toolCall of toolCalls) {
      if (toolCall.name === 'return_from_task_manager_agent') {
        outputs.messages!.push(new ToolMessage(toolCall.args.reason, lastCallManagerTool!.id!))
      }

      toolExecutions.push(executeToolCall(toolCall, taskManagerTools))
    }

    const results = await Promise.allSettled(toolExecutions)

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        outputs.task_manager_tool_results!.push(result.value.message)
        outputs.task_manager_messages!.push(result.value.message)

        if (result.value.meta?.selections) {
          outputs.active_selections!.push(...result.value.meta.selections)
        }
      } else {
        outputs.task_manager_has_error = true
        outputs.task_manager_tool_results!.push(result.reason)
        outputs.task_manager_messages!.push(result.reason)
      }
    })

    return outputs
  }
}
