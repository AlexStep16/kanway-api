import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { executeCode } from '../../helpers/executeCode.js'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { HumanMessage } from '@langchain/core/messages'

export const makeCoderExecutionNode = () => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      coder_messages: state.coder_messages,
      coder_errors: state.coder_errors,
      coder_has_error: false,
      pending_internal_tool_calls: [],
      coder_iterations: state.coder_iterations,
      planner_messages: state.planner_messages,
      final_messages: state.final_messages,
    }

    try {
      const executeResult = await executeCode(
        state.coder_code,
        state.resolved_ambiguities,
        user.id,
        (config.callbacks as any)?.inheritableMetadata || {},
        state.current_payload,
      )

      const pendingToolCalls = (executeResult.pending_tool_calls || []) as Array<{
        id: string
        name: string
        args: Record<string, any>
      }>

      if (executeResult.error && !executeResult.error.includes('InterruptedError')) {
        const errorMessage = new HumanMessage(
          `Error executing code. Look at the error and fix the code: ${executeResult.error}`,
        )
        outputs.coder_messages!.push(errorMessage)
        outputs.coder_errors!.push(errorMessage)
        outputs.coder_has_error = true

        return outputs
      }

      outputs.pending_internal_tool_calls = pendingToolCalls

      if (executeResult.stdout) {
        outputs.planner_messages!.push(
          new HumanMessage(
            `[SANDBOX OUTPUT]\nCode execution result (print):\n${executeResult.stdout}`,
          ),
        )
      }

      outputs.coder_errors = []
    } catch (error) {
      const errorMessage = new HumanMessage(
        `Error executing code: ${error instanceof Error ? error.message : String(error)}`,
      )
      outputs.coder_messages!.push(errorMessage)
      outputs.coder_errors!.push(errorMessage)
      outputs.coder_has_error = true
    } finally {
      outputs.coder_iterations = (state.coder_iterations || 0) + 1

      if (outputs.coder_iterations > 2 && outputs.coder_has_error) {
        outputs.planner_messages!.push(
          new HumanMessage('The code has been executed 3 times with errors.'),
          ...outputs.coder_errors!,
        )
      }
    }

    return outputs
  }
}
