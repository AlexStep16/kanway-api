import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeSkillerToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.skiller_has_error) {
    return 'Skiller'
  } else {
    return 'Coder'
  }
}
