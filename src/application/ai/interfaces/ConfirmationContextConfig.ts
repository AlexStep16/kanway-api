import { ToolCall } from '@langchain/core/messages'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { RunnableConfig } from '@langchain/core/runnables'

type ConfirmationContextMode = 'tool' | 'external'

export interface ConfirmationContextConfig {
  title: string
  context: {
    mode: ConfirmationContextMode
    toolName?: string // если mode === 'tool'
    entityType?: 'task' | 'category' | 'board' | 'workspace' // если mode === 'external'
    externalFetch?: (params: {
      toolCall: ToolCall
      state: typeof AgentStateAnnotation.State
      config: RunnableConfig
    }) => Promise<any>
  }
}
