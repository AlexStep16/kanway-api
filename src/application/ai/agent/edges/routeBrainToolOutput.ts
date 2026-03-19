import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeBrainToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.brain_has_error) {
    return 'Brain'
  } else {
    return 'Skiller'
  }
}
