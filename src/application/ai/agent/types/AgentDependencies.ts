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
}
