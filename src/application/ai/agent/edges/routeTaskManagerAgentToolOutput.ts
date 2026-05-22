import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'

export const routeTaskManagerAgentToolOutput = (state: typeof AgentStateAnnotationOrc.State) => {
  if (state.task_manager_has_error) {
    return 'TaskManagerAgent'
  }

  const lastToolCall = state.task_manager_tool_calls.at(-1)

  if (lastToolCall && lastToolCall.name === 'return_from_task_manager_agent') {
    return 'Orchestrator'
  }

  return 'TaskManagerAgent'
}
