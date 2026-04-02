import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routePlannerToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.planner_has_error) {
    return 'Planner'
  }
  if (state.final_response) {
    return 'Responder'
  } else {
    return 'Skiller'
  }
}
