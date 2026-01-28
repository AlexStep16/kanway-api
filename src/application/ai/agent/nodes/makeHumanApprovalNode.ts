import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { interrupt } from '@langchain/langgraph'

export const makeHumanApprovalNode = () => {
  return async (state: typeof AgentStateAnnotation.State) => {
    const confirmations = state.prepared_confirmations || []

    const review = interrupt({
      type: 'confirmation',
      data: confirmations,
    })

    return {
      tools_cancelled: review.toolsCancelled,
      cancelled_entity_ids: review.cancelledEntityIds,
    }
  }
}
