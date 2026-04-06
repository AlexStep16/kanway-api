import { END } from '@langchain/langgraph'
import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeReplannerOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.tool_calls.length > 0) {
    return 'ReplannerTool'
  }

  return END
}
