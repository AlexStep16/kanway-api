import { getToolCallsByAgent } from '../../helpers/getToolCallsByAgent.js'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeEntityManagerAgentOutput = (state: typeof AgentStateAnnotation.State) => {
  const toolCalls = getToolCallsByAgent(state.active_manager, state)

  if (toolCalls.length > 0) {
    return 'EntityManagerAgentTool'
  }

  return 'Orchestrator'
}
