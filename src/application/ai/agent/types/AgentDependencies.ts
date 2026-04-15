import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ToolDispatcherService } from '../../services/ToolDispatcherService.js'

export interface AgentDependencies {
  services: {
    toolDispatcherService: ToolDispatcherService
  }
  models: {
    plannerModel: BaseChatModel
    coderModel: BaseChatModel
    summarizerModel: BaseChatModel
    chatNameModel: BaseChatModel
  }
}
