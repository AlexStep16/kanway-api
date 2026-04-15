import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { AgentDependencies } from '../types/AgentDependencies.js'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { ToolResult } from '../../tools/helpers/ToolResult.js'
import { ConfirmationEntityToolResult } from '../../tools/helpers/ConfirmationEntityToolResult.js'
import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.js'
import { FailedToolResult } from '../../tools/helpers/FailedToolResult.js'
import { HumanMessage } from '@langchain/core/messages'

export const makeCoderInternalToolNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const pendingToolCalls = state.pending_internal_tool_calls || []
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      internal_tool_call_results: [],
      coder_has_confirmations: false,
      coder_has_ambiguities: false,
      internal_tool_calls_have_error: false,
      coder_messages: state.coder_messages,
      planner_messages: state.planner_messages,
      final_messages: state.final_messages,
    }
    const resolveAmbiguousCall = pendingToolCalls.find((call) => call.name === 'resolve_ambiguous')

    const filteredPendingToolCalls = pendingToolCalls.filter((call) => {
      const toolResult = state.internal_tool_call_results?.find((result) => result[call.id])

      if (!toolResult) {
        return true
      }

      const result = toolResult[call.id]

      if (result.type === ToolResultTypesEnum.CONFIRMATION) return true

      return false
    })

    if (resolveAmbiguousCall) {
      await dispatchCustomEvent(CustomEvents.AMBIGUITY_RESOLUTION, resolveAmbiguousCall.args)

      outputs.coder_ambiguities = resolveAmbiguousCall.args as any
      outputs.coder_has_ambiguities = true

      return outputs
    }

    for (const pendingToolCall of filteredPendingToolCalls) {
      const result = (await deps.services.toolDispatcherService.dispatch({
        toolCall: pendingToolCall,
        userId: user.id.toString(),
        config,
      })) as ToolResult

      if (result instanceof ConfirmationEntityToolResult) {
        await dispatchCustomEvent(CustomEvents.OPERATION, result.meta)

        outputs.coder_has_confirmations = true
      } else if (result instanceof FailedToolResult) {
        outputs.coder_messages!.push(
          new HumanMessage(`Error executing tool ${pendingToolCall.name}: ${result.content}`),
        )
        outputs.internal_tool_calls_have_error = true

        break
      } else {
        const toolResultMessage = new HumanMessage(result.content)

        outputs.planner_messages!.push(toolResultMessage)
        outputs.coder_messages!.push(toolResultMessage)
        outputs.final_messages!.push(toolResultMessage)
      }

      outputs.internal_tool_call_results = [
        {
          [pendingToolCall.id]: result,
        },
      ]
    }

    return outputs
  }
}
