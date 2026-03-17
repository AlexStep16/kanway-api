import { AgentStateAnnotation } from '@/application/aiNew/agent/AgentStateAnnotation.ts'
import { interrupt } from '@langchain/langgraph'
import { SystemMessage } from 'node_modules/@langchain/core/dist/messages/system.js'

export const makeCoderHumanReviewNode = () => {
  return (state: typeof AgentStateAnnotation.State) => {
    const internalToolCallResults = state.internal_tool_call_results || []
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      coder_ambiguities: null,
      coder_messages: [],
    }

    if (state.coder_has_ambiguities) {
      const data = interrupt({
        type: 'resolve_ambiguities',
        data: state.coder_ambiguities,
      }) as {
        ids: string[]
        callId: string
      }

      outputs.resolved_ambiguities = { [data.callId]: data.ids }

      outputs.coder_messages!.push(
        new SystemMessage(`
          User resolved resolve_ambiguous(id = ${state.coder_ambiguities!.id}) call with the following entities: ${data.ids}. You can remove the ambiguity resolution tool call with that ID from the code and use the resolved entities in the code.
        `),
      )
    }

    if (state.coder_has_confirmations) {
      interrupt({
        type: 'confirm_tool_calls',
        data: internalToolCallResults,
      })
    }

    return outputs
  }
}
