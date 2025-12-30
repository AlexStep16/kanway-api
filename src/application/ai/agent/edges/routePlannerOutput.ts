import { AgentStateAnnotation } from '@application/ai/agent/AgentStateAnnotation.ts'

export const routePlannerOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.plan && state.plan.length > 0) {
    return 'agent'
  }

  if (state.planner_has_error) {
    return 'planner'
  }

  return 'synthesize'
}
