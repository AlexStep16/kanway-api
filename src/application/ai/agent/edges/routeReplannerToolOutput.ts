import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeReplannerToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.last_replanner_tool_name === 'continue') {
    return 'Skiller'
  } else if (state.last_replanner_tool_name === 'response_to_user') {
    return 'Responder'
  } else if (state.last_replanner_tool_name === 'update_plan') {
    return 'Skiller'
  } else if (state.replanner_has_error) {
    return 'Replanner'
  } else {
    return 'Responder'
  }
}
