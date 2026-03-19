import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { AgentDependencies } from '../types/AgentDependencies.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { ToolResult } from '../../tools/helpers/ToolResult.ts'
import { ConfirmationEntityToolResult } from '../../tools/helpers/ConfirmationEntityToolResult.ts'
import { ToolResultTypesEnum } from '@/domain/enums/ToolResultTypesEnum.ts'
import { SystemMessage } from '@langchain/core/messages'
import { FailedToolResult } from '../../tools/helpers/FailedToolResult.ts'

export const makeCoderInternalToolNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const pendingToolCalls = state.pending_internal_tool_calls || []
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],
      coder_messages: state.coder_messages,
      internal_tool_call_results: [],
      coder_has_confirmations: false,
      coder_has_ambiguities: false,
      internal_tool_calls_have_error: false,
    }
    const resolveAmbiguousCall = pendingToolCalls.find((call) => call.name === 'resolve_ambiguous')
    const tempToRealIdMap: Record<string, string> = {} // Map for tracking temp IDs to real IDs during creating entities

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
        tempToRealIdMap,
      })) as ToolResult

      if (result instanceof ConfirmationEntityToolResult) {
        await dispatchCustomEvent(CustomEvents.OPERATION, result.meta)

        outputs.coder_has_confirmations = true
      } else if (result instanceof FailedToolResult) {
        outputs.coder_messages!.push(
          new SystemMessage(`Error executing tool ${pendingToolCall.name}: ${result.content}`),
        )
        outputs.internal_tool_calls_have_error = true
      } else {
        if (result.meta?.tempToRealIdMap) {
          Object.assign(tempToRealIdMap, result.meta.tempToRealIdMap)
        }

        outputs.messages!.push(
          new SystemMessage({
            name: pendingToolCall.name,
            content: result.content,
          }),
        )
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
