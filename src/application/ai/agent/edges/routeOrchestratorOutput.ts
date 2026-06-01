import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeOrchestratorOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.orchestrator_tool_calls.length > 0) {
    return 'OrchestratorTool'
  }

  return 'ChatName'
}
