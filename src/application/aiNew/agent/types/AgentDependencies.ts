import { AgentSkillService } from '@/application/services/AgentSkillService.ts'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ToolDispatcherService } from '../../services/ToolDispatcherService.ts'

export interface AgentDependencies {
  services: {
    agentSkillService: AgentSkillService
    toolDispatcherService: ToolDispatcherService
  }
  models: {
    agentModel: BaseChatModel
  }
}
