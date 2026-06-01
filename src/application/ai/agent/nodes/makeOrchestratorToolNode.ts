import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import { initOrchestratorTools } from '../../tools/initOrchestratorTools.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolCall, ToolMessage } from '@langchain/core/messages'
import z, { ZodAny } from 'zod'
import { ToolResult } from '../../tools/helpers/ToolResult/ToolResult.js'
import { AgentDependencies } from '../types/AgentDependencies.js'
import { Configurable } from '../../interfaces/Configurable.js'

async function executeToolCall(toolCall: ToolCall, orchestratorTools: DynamicStructuredTool[]) {
  const toolByToolCalls: DynamicStructuredTool | undefined = orchestratorTools.find(
    (tool) => tool.name === toolCall.name,
  )

  if (!toolByToolCalls) {
    throw new ToolMessage(`Tool ${toolCall.name} not found.`, toolCall.id!)
  }

  const validationResult = (toolByToolCalls.schema as ZodAny).safeParse(toolCall.args)

  if (!validationResult.success) {
    throw new ToolMessage(
      `Validation Error: Invalid arguments. \n${z.prettifyError(
        validationResult.error,
      )}. \nPlease fix the arguments and try again.`,
      toolCall.id!,
    )
  }

  try {
    const observation: ToolResult = await toolByToolCalls.invoke(toolCall.args as any)

    if (!observation.success) {
      throw new ToolMessage(
        `Tool ${toolCall.name} execution failed. Observation: ${observation.content}`,
        toolCall.id!,
      )
    }
    return new ToolMessage(observation.content, toolCall.id!)
  } catch (error) {
    throw new ToolMessage(
      `Tool ${toolCall.name} execution error: ${(error as Error).message}`,
      toolCall.id!,
    )
  }
}

export const makeOrchestratorToolNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig<Configurable>) => {
    const toolCalls = state.orchestrator_tool_calls || []

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],
      orchestrator_tool_results: [],
      orchestrator_has_error: false,
    }

    const orchestratorTools = initOrchestratorTools(deps, config)

    for (const toolCall of toolCalls) {
      try {
        if (toolCall.name === 'call_task_manager_agent') continue

        const result = await executeToolCall(toolCall, orchestratorTools)

        outputs.orchestrator_tool_results!.push(result)
        outputs.messages!.push(result)
      } catch (error: unknown) {
        if (error instanceof ToolMessage) {
          outputs.orchestrator_has_error = true
          outputs.orchestrator_tool_results!.push(error)
          outputs.messages!.push(error)
        } else {
          outputs.orchestrator_has_error = true
          outputs.orchestrator_tool_results!.push(
            new ToolMessage(`Unexpected error: ${(error as Error).message}`, toolCall.id!),
          )
          outputs.messages!.push(
            new ToolMessage(`Unexpected error: ${(error as Error).message}`, toolCall.id!),
          )
        }
      }
    }

    return outputs
  }
}
