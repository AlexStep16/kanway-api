import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ToolMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { getUserConfirmConfig } from '@application/ai/helpers/getUserConfirmConfig.ts'
import z from 'zod'
import { buildConfirmationContext } from '@application/ai/helpers/buildConfirmationContext.ts'
import { interrupt } from '@langchain/langgraph'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { getLastAIToolCallsMessage } from '@application/ai/helpers/getLastAIToolCallsMessage.ts'

export const makeHumanApprovalNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const { contextExternalFetchService } = deps.services
    const configurable = config.configurable as Configurable

    const lastMessage = getLastAIToolCallsMessage(state.messages)

    if (!lastMessage) return {}

    const toolCalls = lastMessage.tool_calls || []
    const toolsByName = deps.services.toolExecutorService.toolsByName

    // 1. Валидация Zod
    const validationErrors = []

    for (const toolCall of toolCalls) {
      const tool = toolsByName[toolCall.name]

      if (!tool) {
        validationErrors.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            name: toolCall.name,
            content: `Tool not found: ${toolCall.name}`,
          })
        )

        continue
      }

      const schema = tool.schema as z.ZodType
      const result = schema.safeParse(toolCall.args)

      if (!result.success) {
        validationErrors.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            name: toolCall.name,
            content: `Validation Error: Invalid arguments. \n${z.prettifyError(
              result.error
            )}. \nPlease fix the arguments and try again.`,
          })
        )
      }
    }

    if (validationErrors.length > 0) {
      return {
        messages: validationErrors,
        validation_failed: true,
      }
    }

    const updates: any = { validation_failed: false }

    const confirmConfig = getUserConfirmConfig(
      configurable?.aiConfirmationType || AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE,
      contextExternalFetchService
    )
    const callsToConfirm = toolCalls.filter((tc) => confirmConfig[tc.name])

    if (callsToConfirm.length > 0) {
      const confirmations = await buildConfirmationContext(toolCalls, state, config, confirmConfig)

      const review = interrupt({
        type: 'confirmation',
        data: confirmations,
      })

      updates.tools_confirmed = review.toolsConfirmed
      updates.tools_cancelled = review.toolsCancelled
    }

    return updates
  }
}
