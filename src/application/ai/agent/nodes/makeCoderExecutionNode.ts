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
      coder_messages: [],
      coder_has_error: false,
      pending_internal_tool_calls: [],
      coder_iterations: 0,
      last_execution_messages: [],
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
        outputs.coder_iterations = state.coder_iterations + 1

        if (state.coder_iterations === 2) {
          outputs.last_execution_messages?.push(
            new SystemMessage('The code has been executed 3 times with errors.'),
            ...outputs.coder_messages,
          )
        }

        return outputs
      }

      outputs.pending_internal_tool_calls = pendingToolCalls
      outputs.coder_iterations = 0

      if (executeResult.stdout) {
        outputs.last_execution_messages?.push(
          new SystemMessage(`Last Step: ${state.current_plan[state.current_step_index || 0]}`),
          new SystemMessage(`Code execution result (print): ${executeResult.stdout}`),
        )
      }

      return outputs
    } catch (error) {
      const errorMessage = new SystemMessage(
        `Error executing code: ${error instanceof Error ? error.message : String(error)}`,
      )
      outputs.coder_messages = [errorMessage]
      outputs.coder_has_error = true
      outputs.coder_iterations = state.coder_iterations + 1

      if (state.coder_iterations === 2) {
        outputs.last_execution_messages?.push(
          new SystemMessage('The code has been executed 3 times with errors.'),
          ...outputs.coder_messages,
        )
      }

      return outputs
    }
  }
}
