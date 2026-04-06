import { END } from '@langchain/langgraph'
import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeReplannerToolOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.replanner_has_error) {
    return 'Replanner'
  } else if (['continue', 'update_plan'].includes(state.last_replanner_tool_name)) {
    return 'Coder'
  } else {
    return END
  }
}
