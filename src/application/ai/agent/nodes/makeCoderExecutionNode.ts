import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { SystemMessage } from '@langchain/core/messages'
import { executeCode } from '../../helpers/executeCode.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'

export const makeCoderExecutionNode = () => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      coder_messages: state.coder_messages,
      coder_has_error: false,
      pending_internal_tool_calls: [],
      execution_output: '',
    }

    try {
      const executeResult = await executeCode(
        state.coder_code,
        state.resolved_ambiguities,
        user.id,
        (config.callbacks as any)?.inheritableMetadata || {},
      )

      const pendingToolCalls = (executeResult.pending_tool_calls || []) as Array<{
        id: string
        name: string
        args: Record<string, any>
      }>

      if (executeResult.error && !executeResult.error.includes('InterruptedError')) {
        outputs.coder_messages = [
          new SystemMessage(
            `Error executing code. Look at the error and fix the code: ${executeResult.error}`,
          ),
        ]
        outputs.coder_has_error = true

        return outputs
      }

      outputs.pending_internal_tool_calls = pendingToolCalls
      outputs.coder_code = state.coder_code
      outputs.execution_output = executeResult.stdout || ''

      return outputs
    } catch (error) {
      outputs.coder_messages = [
        new SystemMessage(
          `Error executing code: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ]
      outputs.coder_has_error = true

      return outputs
    }
  }
}
