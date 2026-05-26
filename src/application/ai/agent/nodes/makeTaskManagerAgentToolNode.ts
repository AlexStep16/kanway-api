import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolCall, ToolMessage } from '@langchain/core/messages'
import z, { ZodAny } from 'zod'
import { ToolResult } from '../../tools/helpers/ToolResult/ToolResult.js'
import { initTaskManagerTools } from '../../tools/initTaskManagerTools.js'
import { AgentDependencies } from '../types/AgentDependencies.js'
import { ConfirmationToolResult } from '../../tools/helpers/ToolResult/ConfirmationToolResult.js'

async function executeToolCall(
  toolCall: ToolCall,
  orchestratorTools: DynamicStructuredTool[],
  reviewedMap?: Map<string, boolean>,
) {
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
    const observation: ToolResult = await toolByToolCalls.invoke(toolCall.args as any, {
      context: {
        isApproved: reviewedMap?.get(toolCall.id!),
        toolCall,
      },
    })

    if (!observation.success) {
      throw new ToolMessage(
        `Tool ${toolCall.name} execution failed. Observation: ${observation.content}`,
        toolCall.id!,
      )
    }

    return {
      message: new ToolMessage(observation.content, toolCall.id!),
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
    const reviewedMap = state.tools_reviewed_map || new Map()

    const outputs: Partial<typeof AgentStateAnnotationOrc.State> = {
      messages: [],
      task_manager_messages: state.task_manager_messages,
      tool_waiting_for_review: null,
      task_manager_tool_results: [],
      task_manager_tool_calls_completed: state.task_manager_tool_calls_completed,
      task_manager_has_error: false,
      active_selections: state.active_selections,
    }

    const taskManagerTools = initTaskManagerTools(dependencies, config)

    for (const toolCall of toolCalls) {
      if (
        state.task_manager_tool_calls_completed.some(
          (completedCall) => completedCall.id === toolCall.id,
        )
      ) {
        continue
      }

      try {
        const result = await executeToolCall(toolCall, taskManagerTools, reviewedMap)

        if (result.message instanceof ConfirmationToolResult) {
          if (!result.meta || !result.meta.logId) {
            throw new ToolMessage(
              `Tool ${toolCall.name} is missing meta information for human review. Developer should check.`,
              toolCall.id!,
            )
          }

          state.tool_waiting_for_review = {
            toolCallId: toolCall.id!,
            logId: result.meta.logId,
          }
          break
        }

        outputs.task_manager_tool_results!.push(result.message)
        outputs.task_manager_messages!.push(result.message)
        outputs.task_manager_tool_calls_completed!.push(toolCall)

        if (result.meta?.selections) {
          outputs.active_selections!.push(...result.meta.selections)
        }
      } catch (error: unknown) {
        if (error instanceof ToolMessage) {
          outputs.task_manager_has_error = true
          outputs.task_manager_tool_results!.push(error)
          outputs.task_manager_messages!.push(error)
        } else {
          outputs.task_manager_has_error = true
          outputs.task_manager_tool_results!.push(
            new ToolMessage(`Unexpected error: ${(error as Error).message}`, toolCall.id!),
          )
          outputs.task_manager_messages!.push(
            new ToolMessage(`Unexpected error: ${(error as Error).message}`, toolCall.id!),
          )
        }
      }
    }

    return outputs
  }
}
