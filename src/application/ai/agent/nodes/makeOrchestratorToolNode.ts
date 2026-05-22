import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'
import { initOrchestratorTools } from '../../tools/initOrchestratorTools.js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ToolCall, ToolMessage } from '@langchain/core/messages'
import z, { ZodAny } from 'zod'
import { ToolResult } from '../../tools/helpers/ToolResult.js'
import { AgentDependencies } from '../types/AgentDependencies.js'

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
    return new ToolMessage(JSON.stringify(observation.content), toolCall.id!)
  } catch (error) {
    throw new ToolMessage(
      `Tool ${toolCall.name} execution error: ${(error as Error).message}`,
      toolCall.id!,
    )
  }
}

export const makeOrchestratorToolNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotationOrc.State, _config: RunnableConfig) => {
    const toolCalls = state.orchestrator_tool_calls || []

    const outputs: Partial<typeof AgentStateAnnotationOrc.State> = {
      messages: [],
      orchestrator_tool_results: [],
      orchestrator_has_error: false,
    }

    const orchestratorTools = initOrchestratorTools(deps)

    const toolExecutions: Promise<ToolMessage>[] = []

    for (const toolCall of toolCalls) {
      if (toolCall.name === 'call_task_manager_agent') {
        continue
      }

      toolExecutions.push(executeToolCall(toolCall, orchestratorTools))
    }

    const results = await Promise.allSettled(toolExecutions)

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        outputs.orchestrator_tool_results!.push(result.value)
        outputs.messages!.push(result.value)
      } else {
        outputs.orchestrator_has_error = true
        outputs.orchestrator_tool_results!.push(result.reason)
        outputs.messages!.push(result.reason)
      }
    })

    return outputs
  }
}
