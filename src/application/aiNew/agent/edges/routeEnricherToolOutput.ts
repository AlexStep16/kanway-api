import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeEnricherToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.enricher_has_error) {
    return 'Enricher'
  } else {
    return 'Skiller'
  }
}
