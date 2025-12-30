import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { AIMessage, ToolMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { IUser } from '@entities/IUser.ts'
import * as Sentry from '@sentry/node'

export const makeToolsExecutorNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const { toolExecutorService } = deps.services
    const configurable = config.configurable as Configurable

    const lastMessage = state.messages.at(-1) as AIMessage

    let toolCalls = lastMessage.tool_calls || []

    const confirmedIds = state.tools_confirmed || []
    const cancelledIds = state.tools_cancelled || []

    if (confirmedIds.length > 0 || cancelledIds.length > 0) {
      toolCalls = toolCalls.filter((tc) => !cancelledIds.includes(tc.id!))
    }

    const cancelMessages = cancelledIds.map(
      (id) =>
        new ToolMessage({
          tool_call_id: id,
          content: 'Tool call cancelled by user request.',
        })
    )

    const executionResults = await Promise.all(
      toolCalls.map(async (tc) => {
        try {
          // Пытаемся выполнить инструмент
          return await toolExecutorService.executeTool(
            tc,
            state.messages,
            configurable?.user as IUser
          )
        } catch (error: any) {
          Sentry.captureException(error, { extra: { chatId: configurable?.chatId } })

          // ВОЗВРАЩАЕМ ошибку Агенту как ToolMessage
          return new ToolMessage({
            tool_call_id: tc.id!,
            name: tc.name,
            content: `Error occurred while executing tool '${tc.name}': ${error.message}.`,
            additional_kwargs: { error: true },
          })
        }
      })
    )

    return {
      messages: [...executionResults, ...cancelMessages],
      tools_confirmed: [],
      tools_cancelled: [],
    }
  }
}
