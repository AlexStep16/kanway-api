import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolCall, ToolMessage } from '@langchain/core/messages'
import z, { ZodAny } from 'zod'
import { ToolResult } from '../../tools/helpers/ToolResult/ToolResult.js'
import { AgentDependencies } from '../types/AgentDependencies.js'
import { ConfirmationToolResult } from '../../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { IConfigContext } from '../../interfaces/IConfigContext.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { getAgentManagerTools } from '../../helpers/managerHelpers.js'
import { getToolCallsByAgent } from '../../helpers/getToolCallsByAgent.js'
import { getCurrentAgentOutputs } from '../../helpers/getCurrentAgentOutput.js'
import { initManagerTools } from '../../tools/initManagerTools.js'
import { Configurable } from '../../interfaces/Configurable.js'

export const makeEntityManagerAgentToolNode = (dependencies: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const activeManager = state.active_manager as AgentsEnum

    const toolCalls = getToolCallsByAgent(activeManager, state)
    const configurable = config.configurable as Configurable

    const reviewedByToolCallId = state.tools_reviewed_map || new Map()
    const statusLogByToolCallId = state.tools_log_map || new Map()

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],
      messages_summary: state.messages_summary,

      tool_waiting_for_review: null,

      task_manager_messages: state.task_manager_messages,
      task_manager_tool_results: state.task_manager_tool_results,
      task_manager_tool_calls_completed: state.task_manager_tool_calls_completed,

      column_manager_messages: state.column_manager_messages,
      column_manager_tool_results: state.column_manager_tool_results,
      column_manager_tool_calls_completed: state.column_manager_tool_calls_completed,

      board_manager_messages: state.board_manager_messages,
      board_manager_tool_results: state.board_manager_tool_results,
      board_manager_tool_calls_completed: state.board_manager_tool_calls_completed,

      workspace_manager_messages: state.workspace_manager_messages,
      workspace_manager_tool_results: state.workspace_manager_tool_results,
      workspace_manager_tool_calls_completed: state.workspace_manager_tool_calls_completed,

      operation_log_ids: state.operation_log_ids,
      manager_tools_has_error: false,
      active_selections: state.active_selections,
      requested_tools: state.requested_tools,
    }

    const managerTools = getAgentManagerTools(activeManager, dependencies, config)
    const mainManagerTools = initManagerTools()
    const {
      toolCalls: managerToolCalls,
      toolCallsCompleted: managerToolCallsCompleted,
      toolResults: managerToolResults,
      messages: managerMessages,
    } = getCurrentAgentOutputs(activeManager, outputs)

    for (const toolCall of toolCalls) {
      if (managerToolCallsCompleted.some((completedCall) => completedCall.id === toolCall.id)) {
        continue
      }

      if (toolCall.name === 'lookup_toolset') {
        await validateToolCall(
          toolCall,
          mainManagerTools.find((tool) => tool.name === toolCall.name)!,
        )

        const toolNames = toolCall.args.tool_names as string[]

        outputs.requested_tools!.push(...toolNames)

        managerMessages.push(
          new ToolMessage(
            `Tools: ${toolNames.join(', ')} are available to call now`,
            toolCall.id!,
            toolCall.name,
          ),
        )

        continue
      }

      try {
        const result = await executeToolCall(
          toolCall,
          managerTools,
          reviewedByToolCallId,
          statusLogByToolCallId,
        )

        if (result.observation instanceof ConfirmationToolResult) {
          outputs.tool_waiting_for_review = {
            toolCallId: toolCall.id!,
            logId: result.meta?.logId,
          }

          if (result.meta?.logId && outputs.operation_log_ids) {
            if (!outputs.operation_log_ids.has(configurable.iterationId)) {
              outputs.operation_log_ids.set(configurable.iterationId, [])
            }
            outputs.operation_log_ids.get(configurable.iterationId)!.push(result.meta.logId)
          }

          break
        }

        const toolMessage = new ToolMessage(result.observation.content, toolCall.id!, toolCall.name)

        managerToolResults.push(toolMessage)
        managerMessages.push(toolMessage)
        managerToolCalls.push(toolCall)
        managerToolCallsCompleted.push(toolCall)

        if (result.meta?.selections) {
          outputs.active_selections!.push(...result.meta.selections)
        }
      } catch (error: unknown) {
        console.error('ManagerAgentToolNode error:', error)

        if (error instanceof ToolMessage) {
          outputs.manager_tools_has_error = true

          managerToolResults.push(error)
          managerMessages.push(error)
        } else {
          outputs.manager_tools_has_error = true

          managerToolResults.push(
            new ToolMessage(
              `Unexpected error: ${(error as Error).message}`,
              toolCall.id!,
              toolCall.name,
            ),
          )
          managerMessages.push(
            new ToolMessage(
              `Unexpected error: ${(error as Error).message}`,
              toolCall.id!,
              toolCall.name,
            ),
          )
        }
      }
    }

    return outputs
  }
}

async function validateToolCall(
  toolCall: ToolCall,
  toolByToolCalls: DynamicStructuredTool,
): Promise<boolean> {
  const validationResult = await (toolByToolCalls.schema as ZodAny).safeParseAsync(toolCall.args)

  if (!validationResult.success) {
    throw new ToolMessage(
      `Validation Error: Invalid arguments. \n${z.prettifyError(
        validationResult.error,
      )}. \nPlease fix the arguments and try again.`,
      toolCall.id!,
      toolCall.name,
    )
  }

  return true
}

async function executeToolCall(
  toolCall: ToolCall,
  managerTools: DynamicStructuredTool[],
  reviewedByToolCallId?: Map<string, boolean>,
  statusLogByToolCallId?: Map<string, StatusLog>,
) {
  try {
    const toolByToolCalls: DynamicStructuredTool | undefined = managerTools.find(
      (tool) => tool.name === toolCall.name,
    )

    if (!toolByToolCalls) {
      throw new ToolMessage(`Tool ${toolCall.name} not found.`, toolCall.id!, toolCall.name)
    }

    await validateToolCall(toolCall, toolByToolCalls)

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
        toolCall.name,
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
      toolCall.name,
    )
  }
}
