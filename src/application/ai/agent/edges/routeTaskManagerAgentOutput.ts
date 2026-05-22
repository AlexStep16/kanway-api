import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'

export const routeTaskManagerAgentOutput = (state: typeof AgentStateAnnotationOrc.State) => {
  if (state.task_manager_tool_calls.length > 0) {
    return 'TaskManagerAgentTool'
  }

  return 'Orchestrator'
}
