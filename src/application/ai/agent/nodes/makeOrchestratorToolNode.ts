import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import { initOrchestratorTools } from '../../tools/initOrchestratorTools.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolCall, ToolMessage } from '@langchain/core/messages'
import z, { ZodAny } from 'zod'
import { ToolResult } from '../../tools/helpers/ToolResult/ToolResult.js'
import { AgentDependencies } from '../types/AgentDependencies.js'
import { Configurable } from '../../interfaces/Configurable.js'
import { IConfigContext } from '../../interfaces/IConfigContext.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { ConfirmationToolResult } from '../../tools/helpers/ToolResult/ConfirmationToolResult.js'

export const makeOrchestratorToolNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const toolCalls = state.orchestrator_tool_calls || []

    const reviewedByToolCallId = state.tools_reviewed_map || new Map()
    const statusLogByToolCallId = state.tools_log_map || new Map()
    let managerCallsCount = 0

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],

      tool_waiting_for_review: null,

      orchestrator_tool_results: [],
      orchestrator_tool_calls_completed: state.orchestrator_tool_calls_completed,
      orchestrator_tool_calls: [],
      orchestrator_has_error: false,
      is_manager_called: false,
    }

    const orchestratorTools = initOrchestratorTools(deps, config as RunnableConfig<Configurable>)

    for (const toolCall of toolCalls) {
      if (
        state.orchestrator_tool_calls_completed!.some(
          (completedCall) => completedCall.id === toolCall.id,
        )
      ) {
        continue
      }

      try {
        outputs.orchestrator_tool_calls!.push(toolCall)

        const toolByToolCalls: DynamicStructuredTool | undefined = orchestratorTools.find(
          (tool) => tool.name === toolCall.name,
        )

        if (!toolByToolCalls) {
          throw new ToolMessage(`Tool ${toolCall.name} not found.`, toolCall.id!)
        }

        const validationResult = await (toolByToolCalls.schema as ZodAny).safeParseAsync(
          toolCall.args,
        )

        if (!validationResult.success) {
          throw new ToolMessage(
            `Validation Error: Invalid arguments. \n${z.prettifyError(
              validationResult.error,
            )}. \nPlease fix the arguments and try again.`,
            toolCall.id!,
          )
        }

        if (toolCall.name === 'call_manager_agent') {
          if (managerCallsCount >= 1) {
            throw new ToolMessage(`Manager agent has already been called once.`, toolCall.id!)
          }
          outputs.active_manager = toolCall.args.manager
          outputs.is_manager_called = true
          managerCallsCount++
          continue
        }

        const result = await executeToolCall(
          toolCall,
          toolByToolCalls,
          reviewedByToolCallId,
          statusLogByToolCallId,
        )

        if (result.observation instanceof ConfirmationToolResult) {
          outputs.tool_waiting_for_review = {
            toolCallId: toolCall.id!,
            logId: result.meta?.logId,
          }
          break
        }

        const toolMessage = new ToolMessage(result.observation.content, toolCall.id!)

        outputs.orchestrator_tool_results!.push(toolMessage)
        outputs.messages!.push(toolMessage)
        outputs.orchestrator_tool_calls_completed!.push(toolCall)

        if (result.meta?.selections) {
          outputs.active_selections!.push(...result.meta.selections)
        }
      } catch (error: unknown) {
        if (error instanceof ToolMessage) {
          outputs.orchestrator_has_error = true
          outputs.orchestrator_tool_results!.push(error)
          outputs.messages!.push(error)
        } else {
          outputs.orchestrator_has_error = true
          outputs.orchestrator_tool_results!.push(
            new ToolMessage(`Unexpected error: ${(error as Error).message}`, toolCall.id!),
          )
          outputs.messages!.push(
            new ToolMessage(`Unexpected error: ${(error as Error).message}`, toolCall.id!),
          )
        }
      }
    }

    return outputs
  }
}

async function executeToolCall(
  toolCall: ToolCall,
  toolByToolCalls: DynamicStructuredTool,
  reviewedByToolCallId?: Map<string, boolean>,
  statusLogByToolCallId?: Map<string, StatusLog>,
) {
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
