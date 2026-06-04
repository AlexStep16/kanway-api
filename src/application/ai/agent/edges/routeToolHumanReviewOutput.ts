import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeToolHumanReviewOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.tools_reviewed_map.size === 0) {
    if (state.current_agent === AgentsEnum.ORCHESTRATOR) {
      return 'Orchestrator'
    }

    return 'EntityManagerAgent'
  }

  if (state.current_agent === AgentsEnum.ORCHESTRATOR) {
    return 'OrchestratorTool'
  }

  return 'EntityManagerAgentTool'
}
