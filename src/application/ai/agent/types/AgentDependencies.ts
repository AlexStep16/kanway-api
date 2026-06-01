import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TaskToolsExecutorService } from '../../services/TaskToolsExecutorService.js'
import { GeneralToolsExecutor } from '../../services/GeneralToolsExecutor.js'

export interface AgentDependencies {
  services: {
    taskToolsExecutorService: TaskToolsExecutorService
    generalToolsExecutor: GeneralToolsExecutor
  }
  models: {
    ORCHESTRATOR: BaseChatModel
    ORCHESTRATOR_PRO: BaseChatModel
    PLANNER: BaseChatModel
    CODER: BaseChatModel
    PLANNER_PRO: BaseChatModel
    CODER_PRO: BaseChatModel
    SUMMARIZER: BaseChatModel
    CHAT_NAME: BaseChatModel
  }
}
