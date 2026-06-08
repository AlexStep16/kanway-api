import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.js'

export function getCurrentAgentOutputs(
  agent: AgentsEnum,
  outputs: Partial<typeof AgentStateAnnotation.State>,
) {
  switch (agent) {
    case AgentsEnum.TASK_MANAGER:
      return {
        toolCalls: outputs.task_manager_tool_calls || [],
        toolResults: outputs.task_manager_tool_results || [],
        toolCallsCompleted: outputs.task_manager_tool_calls_completed || [],
        messages: outputs.task_manager_messages || [],
      }
    case AgentsEnum.COLUMN_MANAGER:
      return {
        toolCalls: outputs.column_manager_tool_calls || [],
        toolResults: outputs.column_manager_tool_results || [],
        toolCallsCompleted: outputs.column_manager_tool_calls_completed || [],
        messages: outputs.column_manager_messages || [],
      }
    case AgentsEnum.BOARD_MANAGER:
      return {
        toolCalls: outputs.board_manager_tool_calls || [],
        toolResults: outputs.board_manager_tool_results || [],
        toolCallsCompleted: outputs.board_manager_tool_calls_completed || [],
        messages: outputs.board_manager_messages || [],
      }
    case AgentsEnum.WORKSPACE_MANAGER:
      return {
        toolCalls: outputs.workspace_manager_tool_calls || [],
        toolResults: outputs.workspace_manager_tool_results || [],
        toolCallsCompleted: outputs.workspace_manager_tool_calls_completed || [],
        messages: outputs.workspace_manager_messages || [],
      }
    default:
      return {
        toolCalls: [],
        toolResults: [],
        toolCallsCompleted: [],
        messages: [],
      }
  }
}
