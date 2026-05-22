import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'

export const routeOrchestratorOutput = (state: typeof AgentStateAnnotationOrc.State) => {
  if (state.orchestrator_tool_calls.length > 0) {
    return 'OrchestratorTool'
  }

  return 'ChatName'
}
