import { AgentStateAnnotation } from '../AgentStateAnnotation.ts'

export const routeBrainOutput = (state: typeof AgentStateAnnotation.State) => {
  if (state.tool_calls && state.tool_calls.length > 0) {
    const hasFinishResponse = state.tool_calls.some(
      (toolCall) => toolCall.name === 'finish_response',
    )

    if (hasFinishResponse) {
      return 'Responder'
    } else return 'BrainTool'
  } else {
    return 'Skiller'
  }
}
