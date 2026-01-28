import { ToolExecutorService } from '@application/ai/services/ToolExecutorService.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'

export interface AgentDependencies {
  services: {
    toolExecutorService: ToolExecutorService
    contextExternalFetchService: ContextExternalFetchService
    vectorSearchService: VectorSearchService
  }
  models: {
    agentModel: BaseChatModel
    synthesizerModel: BaseChatModel
    summarizerModel: BaseChatModel
  }
}
