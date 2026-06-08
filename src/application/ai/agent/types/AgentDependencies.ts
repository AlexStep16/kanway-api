import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TaskToolsExecutorService } from '../../services/TaskToolsExecutorService.js'
import { GeneralToolsExecutor } from '../../services/GeneralToolsExecutor.js'
import { ColumnToolsExecutorService } from '../../services/ColumnToolsExecutorService.js'
import { BoardToolsExecutorService } from '../../services/BoardToolsExecutorService.js'
import { WorkspaceToolsExecutorService } from '../../services/WorkspaceToolsExecutorService.js'

export interface AgentDependencies {
  services: {
    taskToolsExecutorService: TaskToolsExecutorService
    columnToolsExecutorService: ColumnToolsExecutorService
    boardToolsExecutorService: BoardToolsExecutorService
    workspaceToolsExecutorService: WorkspaceToolsExecutorService
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
