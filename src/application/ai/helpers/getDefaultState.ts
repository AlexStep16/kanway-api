import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.js'

export function getDefaultState(): Partial<typeof AgentStateAnnotation.State> {
  return {
    messages: [],
    task_manager_messages: [],
    column_manager_messages: [],
    board_manager_messages: [],
    workspace_manager_messages: [],

    tool_waiting_for_review: null,

    /** ERRORS */
    orchestrator_has_error: false,
    manager_tools_has_error: false,

    is_orchestrator_initiated: false,
    active_manager: AgentsEnum.ORCHESTRATOR,
    current_agent: AgentsEnum.ORCHESTRATOR,
    is_manager_called: false,
  }
}
