import { AgentStateAnnotation } from '@application/ai/agent/AgentStateAnnotation.ts'

export const routePlannerOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.plan && state.plan.length > 0) {
    return 'summarizer'
  }

  if (state.planner_has_error) {
    return 'planner'
  }

  return 'chatbot'
}
