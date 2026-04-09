import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routePlannerOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.tool_calls.length > 0) {
    return 'PlannerTool'
  }

  return 'ChatName'
}
