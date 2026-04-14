import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeCoderExecutionOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.coder_has_error) {
    if (state.coder_iterations > 2) return 'Planner'

    return 'Coder'
  } else {
    return 'CoderInternalTool'
  }
}
