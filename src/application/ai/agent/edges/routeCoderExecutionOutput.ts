import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeCoderExecutionOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.coder_has_error) {
    return 'Coder'
  } else {
    return 'CoderInternalTool'
  }
}
