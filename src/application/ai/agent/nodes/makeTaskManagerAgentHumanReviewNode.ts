import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import { interrupt } from '@langchain/langgraph'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { IToolReview } from '../../interfaces/IToolReview.js'
import { ToolReviewResumePayload } from '../types/ToolReviewResumePayload.js'

export const makeTaskManagerAgentHumanReviewNode = () => {
  return (state: typeof AgentStateAnnotation.State, _config: RunnableConfig) => {
    const toolWaitingForReview = state.tool_waiting_for_review
    const toolsReviewedMap = state.tools_reviewed_map || new Map()
    const toolsLogMap = state.tools_log_map || new Map()

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
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
    }) as ToolReviewResumePayload

    if (data.toolId !== toolWaitingForReview.toolCallId) {
      throw new Error(
        `Tool review payload mismatch: expected ${toolWaitingForReview.toolCallId}, got ${data.toolId}`,
      )
    }

    const isToolApproved = data.isConfirmed && !data.isRejected

    toolsReviewedMap.set(toolWaitingForReview.toolCallId, isToolApproved)

    if (data.statusLog) {
      toolsLogMap.set(toolWaitingForReview.toolCallId, data.statusLog)
    }

    outputs.tools_reviewed_map = toolsReviewedMap
    outputs.tools_log_map = toolsLogMap

    return outputs
  }
}
