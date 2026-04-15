import { AgentStateAnnotation } from '../AgentStateAnnotation.js'

export const routeCoderInternalToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.internal_tool_calls_have_error) {
    return 'Coder'
  } else {
    return 'CoderHumanReview'
  }
}
