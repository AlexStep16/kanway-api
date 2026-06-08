import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.js'

export function getToolCallsByAgent(agent: AgentsEnum, state: typeof AgentStateAnnotation.State) {
  switch (agent) {
    case AgentsEnum.TASK_MANAGER:
      return state.task_manager_tool_calls || []
    case AgentsEnum.COLUMN_MANAGER:
      return state.column_manager_tool_calls || []
    case AgentsEnum.BOARD_MANAGER:
      return state.board_manager_tool_calls || []
    default:
      return []
  }
}
