import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'

export const routeTaskManagerAgentHumanReviewOutput = (
  state: typeof AgentStateAnnotationOrc.State,
) => {
  if (state.tools_reviewed_map.size === 0) {
    return 'TaskManagerAgent'
  }

  return 'TaskManagerAgentTool'
}
