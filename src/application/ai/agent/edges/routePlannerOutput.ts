import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routePlannerOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.tool_calls.length > 0) {
    return 'PlannerTool'
  }

  return 'ChatName'
}
