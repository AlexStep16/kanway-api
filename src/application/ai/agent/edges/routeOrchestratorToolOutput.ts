import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeOrchestratorToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.orchestrator_has_error) {
    return 'Orchestrator'
  }

  if (state.tool_waiting_for_review) return 'ToolHumanReview'

  if (state.is_manager_called) {
    return 'EntityManagerAgent'
  }

  return 'Orchestrator'
}
