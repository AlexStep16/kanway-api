import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'

export const routePrepareToolCallsOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.validation_failed) {
    return 'retry'
  }

  if (state.is_confirmation_needed) {
    return 'approve'
  }

  return 'execute'
}
