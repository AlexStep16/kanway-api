import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import * as Sentry from '@sentry/node'

export const makeToolsExecutorNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const { toolExecutorService } = deps.services
    const configurable = config.configurable as Configurable

    const lastMessage = state.messages.at(-1) as AIMessage

    let toolCalls = lastMessage.tool_calls || []

    const cancelledIds = state.tools_cancelled || []

    if (cancelledIds.length > 0) {
      toolCalls = toolCalls.filter((tc) => !cancelledIds.includes(tc.id!))
    }

    const cancelMessages = cancelledIds.map(
      (id) =>
        new ToolMessage({
          tool_call_id: id,
          content: 'Tool call cancelled by user request.',
        }),
    )

    const executionResults = await Promise.all(
      toolCalls.map(async (tc) => {
        try {
          return await toolExecutorService.executeTool(tc, state.cancelled_entity_ids)
        } catch (error: any) {
          Sentry.captureException(error, { extra: { chatId: configurable?.chatId } })

          return new ToolMessage({
            tool_call_id: tc.id!,
            name: tc.name,
            content: `Error occurred while executing tool '${tc.name}': ${error.message}.`,
            additional_kwargs: { error: true },
          })
        }
      }),
    )

    const cancelledEntityMessages: SystemMessage[] = []

    if (state.cancelled_entity_ids && state.cancelled_entity_ids.length > 0) {
      cancelledEntityMessages.push(
        new SystemMessage({
          content: `Some of the requested entities were filtered by user and not processed while executing tools. DO NOT continue processing these entities.`,
        }),
      )
    }

    return {
      messages: [...executionResults, ...cancelMessages, ...cancelledEntityMessages],
      tools_cancelled: [],
      cancelled_entity_ids: [],
      prepared_confirmations: [],
      is_confirmation_needed: false,
    }
  }
}
