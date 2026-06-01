import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolCall, ToolMessage } from '@langchain/core/messages'
import z, { ZodAny } from 'zod'
import { ToolResult } from '../../tools/helpers/ToolResult/ToolResult.js'
import { initTaskManagerTools } from '../../tools/initTaskManagerTools.js'
import { AgentDependencies } from '../types/AgentDependencies.js'
import { ConfirmationToolResult } from '../../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { IConfigContext } from '../../interfaces/IConfigContext.js'

async function executeToolCall(
  toolCall: ToolCall,
  taskManagerTools: DynamicStructuredTool[],
  reviewedByToolCallId?: Map<string, boolean>,
  statusLogByToolCallId?: Map<string, StatusLog>,
) {
  const toolByToolCalls: DynamicStructuredTool | undefined = taskManagerTools.find(
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
    const toolCallId = toolCall.id!

    const context: IConfigContext = {
      isApproved: reviewedByToolCallId?.get(toolCallId),
      statusLog: statusLogByToolCallId?.get(toolCallId),
      toolCall,
    }
    const observation: ToolResult = await toolByToolCalls.invoke(toolCall.args as any, {
      context,
    })

    if (!observation.success) {
      throw new ToolMessage(
        `Tool ${toolCall.name} execution failed. Observation: ${observation.content}`,
        toolCall.id!,
      )
    }

    return {
      observation,
      meta: observation.meta,
    }
  } catch (error) {
    if (error instanceof ToolMessage) {
      throw error
    }

    throw new ToolMessage(
      `Tool ${toolCall.name} execution error: ${(error as Error).message}`,
      toolCall.id!,
    )
  }
}

export const makeTaskManagerAgentToolNode = (dependencies: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const toolCalls = state.task_manager_tool_calls || []
    const reviewedByToolCallId = state.tools_reviewed_map || new Map()
    const statusLogByToolCallId = state.tools_log_map || new Map()
    const completedToolCalls = state.task_manager_tool_calls_completed || []

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],
      task_manager_messages: state.task_manager_messages,
      tool_waiting_for_review: null,
      task_manager_tool_results: [],
      task_manager_tool_calls_completed: completedToolCalls,
      task_manager_has_error: false,
      active_selections: state.active_selections,
    }

    const taskManagerTools = initTaskManagerTools(dependencies, config)

    for (const toolCall of toolCalls) {
      if (completedToolCalls.some((completedCall) => completedCall.id === toolCall.id)) {
        continue
      }

      try {
        const result = await executeToolCall(
          toolCall,
          taskManagerTools,
          reviewedByToolCallId,
          statusLogByToolCallId,
        )

        if (result.observation instanceof ConfirmationToolResult) {
          await dispatchCustomEvent(CustomEvents.INTERRUPTED, {})

          if (!result.meta || !result.meta.logId) {
            throw new ToolMessage(
              `Tool ${toolCall.name} is missing meta information for human review. Developer should check.`,
              toolCall.id!,
            )
          }
          outputs.tool_waiting_for_review = {
            toolCallId: toolCall.id!,
            logId: result.meta.logId,
          }
          break
        }

        const toolMessage = new ToolMessage(result.observation.content, toolCall.id!)

        outputs.task_manager_tool_results!.push(toolMessage)
        outputs.task_manager_messages!.push(toolMessage)
        outputs.task_manager_tool_calls_completed!.push(toolCall)

        if (result.meta?.selections) {
          outputs.active_selections!.push(...result.meta.selections)
        }
      } catch (error: unknown) {
        console.error('TaskManagerAgentToolNode error:', error)
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
