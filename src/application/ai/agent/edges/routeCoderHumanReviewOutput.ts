import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeCoderHumanReviewOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.coder_has_ambiguities) {
    return 'CoderExecution'
  } else if (state.coder_has_confirmations) {
    return 'CoderInternalTool'
  } else {
    return 'Planner'
  }
}
