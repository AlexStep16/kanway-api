import { ToolExecutorService } from '@application/ai/services/ToolExecutorService.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { UserService } from '@/application/services/UserService.ts'

export interface AgentDependencies {
  services: {
    toolExecutorService: ToolExecutorService
    contextExternalFetchService: ContextExternalFetchService
    vectorSearchService: VectorSearchService
    userService: UserService
  }
  models: {
    agentModel: BaseChatModel
    synthesizerModel: BaseChatModel
    summarizerModel: BaseChatModel
  }
}
