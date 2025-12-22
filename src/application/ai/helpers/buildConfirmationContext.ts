import { ToolCall, ToolMessage } from '@langchain/core/messages'
import { AgentStateAnnotation } from '@application/ai/agents/AgentStateAnnotation.ts'
import { confirmationConfigs } from '@application/ai/configs/confirmationConfigs.ts'
import { RunnableConfig } from '@langchain/core/runnables'

export async function buildConfirmationContext(
  toolCall: ToolCall,
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig
) {
  const conf = confirmationConfigs[toolCall.name]
  if (!conf) return { title: null, contextData: null }

  const { context } = conf

  // 1. Контекст из предыдущего ToolMessage
  if (context.mode === 'tool') {
    const toolMsg = [...state.messages]
      .reverse()
      .find(
        (m) => m.constructor?.name === 'ToolMessage' && (m as any).name === context.toolName
      ) as ToolMessage | undefined

    if (!toolMsg) {
      return {
        title: conf.title,
        contextData: null,
      }
    }

    let parsed: any = toolMsg.content

    try {
      parsed = JSON.parse(toolMsg.content as string)
    } catch {
      parsed = {}
    }
    return { title: conf.title, contextData: parsed }
  }

  // 2. Внешний контекст через контроллер
  if (context.mode === 'external') {
    if (!context.externalFetch) {
      return { title: conf.title, contextData: null }
    }
    try {
      const data = await context.externalFetch({ toolCall, state, config })

      return { title: conf.title, entityType: context.entityType, contextData: data }
    } catch (e: any) {
      return {
        title: conf.title,
        contextData: null,
      }
    }
  }

  return { title: conf.title, contextData: null }
}
