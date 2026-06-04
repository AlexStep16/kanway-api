import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeEntityManagerAgentToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.manager_tools_has_error) {
    return 'EntityManagerAgent'
  }

  if (state.tool_waiting_for_review) return 'ToolHumanReview'

  return 'EntityManagerAgent'
}
