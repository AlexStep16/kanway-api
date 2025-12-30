import { ToolCall, ToolMessage } from '@langchain/core/messages'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { RunnableConfig } from '@langchain/core/runnables'
import { ConfirmationContextConfig } from '@/application/ai/interfaces/ConfirmationContextConfig.ts'
import * as Sentry from '@sentry/node'

interface Confirmation {
  title: string | null
  data: any | null
  entityType?: string
  toolCall: ToolCall | null
}

export async function buildConfirmationContext(
  toolCalls: ToolCall[],
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
  confirmationConfig: Record<string, ConfirmationContextConfig>
) {
  const confirmations: Array<Confirmation> = []

  if (!confirmationConfig) return [{ title: null, data: null, toolCall: null }]

  for (const toolCall of toolCalls) {
    const toolConfig = confirmationConfig[toolCall.name]
    const { context } = toolConfig

    // 1. Контекст из предыдущего ToolMessage
    if (context.mode === 'tool') {
      const toolMsg = [...state.messages]
        .reverse()
        .find((m) => m instanceof ToolMessage && m.name === context.toolName) as
        | ToolMessage
        | undefined

      if (!toolMsg) {
        confirmations.push({
          title: toolConfig.title,
          data: null,
          toolCall,
        })

        continue
      }

      let parsed: any = toolMsg.content

      try {
        parsed = JSON.parse(toolMsg.content as string)
      } catch {
        parsed = {}
      }

      return { title: toolConfig.title, data: parsed, toolCall }
    }

    // 2. Внешний контекст через контроллер
    if (context.mode === 'external') {
      if (!context.externalFetch) {
        confirmations.push({ title: toolConfig.title, data: null, toolCall })

        continue
      }

      try {
        const data = await context.externalFetch({ toolCall, state, config })

        confirmations.push({
          title: toolConfig.title,
          entityType: context.entityType,
          data: data,
          toolCall,
        })
      } catch (e: any) {
        Sentry.captureException(e)

        confirmations.push({
          title: toolConfig.title,
          data: null,
          toolCall,
        })
      }
    }
  }

  return confirmations
}
