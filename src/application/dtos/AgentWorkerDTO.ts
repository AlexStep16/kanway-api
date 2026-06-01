import { RunnableConfig } from '@langchain/core/runnables'

export interface AgentWorkerDTO {
  payload: Record<string, any>
  config: RunnableConfig
  isResume?: boolean
  isRetry?: boolean
}
