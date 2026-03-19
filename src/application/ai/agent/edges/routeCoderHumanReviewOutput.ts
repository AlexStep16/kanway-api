import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeCoderHumanReviewOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.coder_has_ambiguities) {
    return 'CoderExecution'
  } else if (state.internal_tool_calls_have_error) {
    return 'Coder'
  } else if (state.coder_has_confirmations) {
    return 'CoderInternalTool'
  } else {
    return 'Responder'
  }
}
