import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeTaskManagerAgentOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.task_manager_tool_calls.length > 0) {
    return 'TaskManagerAgentTool'
  }

  return 'Orchestrator'
}
