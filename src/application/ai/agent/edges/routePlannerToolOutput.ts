import { END } from '@langchain/langgraph'
import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routePlannerToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.planner_has_error) {
    return 'Planner'
  } else if (state.last_planner_tool_name === 'execute_plan') {
    return 'Coder'
  }

  return END
}
