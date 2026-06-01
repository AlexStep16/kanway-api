import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeTaskManagerAgentHumanReviewOutput = (
  state: typeof AgentStateAnnotation.State,
) => {
  if (state.tools_reviewed_map.size === 0) {
    return 'TaskManagerAgent'
  }

  return 'TaskManagerAgentTool'
}
