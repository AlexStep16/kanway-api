import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'
import { interrupt } from '@langchain/langgraph'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { IToolReview } from '../../interfaces/IToolReview.js'

export const makeTaskManagerAgentHumanReviewNode = () => {
  return (state: typeof AgentStateAnnotationOrc.State, _config: RunnableConfig) => {
    const toolWaitingForReview = state.tool_waiting_for_review
    const toolsReviewedMap = state.tools_reviewed_map || new Map()

    const outputs: Partial<typeof AgentStateAnnotationOrc.State> = {
      tool_waiting_for_review: null,
    }

    if (!toolWaitingForReview) {
      return outputs
    }

    const toolReviewData: IToolReview = {
      toolCallId: toolWaitingForReview.toolCallId,
      logId: toolWaitingForReview.logId,
    }

    const data = interrupt({
      type: CustomEvents.TOOL_REVIEW,
      data: toolReviewData,
    }) as boolean

    toolsReviewedMap.set(toolWaitingForReview.toolCallId, data)

    outputs.tools_reviewed_map = toolsReviewedMap

    return outputs
  }
}
