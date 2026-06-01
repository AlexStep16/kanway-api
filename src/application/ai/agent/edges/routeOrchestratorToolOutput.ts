import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeOrchestratorToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.orchestrator_has_error) {
    return 'Orchestrator'
  }

  const lastToolCall = state.orchestrator_tool_calls.at(-1)

  if (lastToolCall && lastToolCall.name === 'call_task_manager_agent') {
    return 'TaskManagerAgent'
  }

  return 'Orchestrator'
}
