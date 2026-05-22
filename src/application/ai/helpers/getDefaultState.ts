import { AgentStateAnnotationOrc } from '../agent/AgentStateAnnotationOrc.js'

export function getDefaultState(): typeof AgentStateAnnotationOrc.State {
  return {
    messages: [],
    active_selections: [],
    task_manager_messages: [],
    orchestrator_tool_calls: [],
    task_manager_tool_calls: [],
    orchestrator_tool_results: [],
    task_manager_tool_results: [],
    orchestrator_has_error: false,
    task_manager_has_error: false,
  }
}
