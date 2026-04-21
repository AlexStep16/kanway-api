import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ToolDispatcherService } from '../../services/ToolDispatcherService.js'

export interface AgentDependencies {
  services: {
    toolDispatcherService: ToolDispatcherService
  }
  models: {
    PLANNER: BaseChatModel
    CODER: BaseChatModel
    PLANNER_PRO: BaseChatModel
    CODER_PRO: BaseChatModel
    SUMMARIZER: BaseChatModel
    CHAT_NAME: BaseChatModel
  }
}
