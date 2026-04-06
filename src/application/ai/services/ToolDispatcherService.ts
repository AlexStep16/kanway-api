import { AbstractToolExecutor } from './AbstractToolExecutor.ts'
import { PendingToolCall } from '../agent/AgentStateAnnotation.ts'
import { GeneralToolsExecutor } from './GeneralToolsExecutor.ts'
import { TaskToolsExecutorService } from './TaskToolsExecutorService.ts'
import { CategoryToolsExecutorService } from './CategoryToolsExecutorService.ts'
import { WorkspaceToolsExecutorService } from './WorkspaceToolsExecutorService.ts'
import { BoardToolsExecutorService } from './BoardToolsExecutorService.ts'
import { ToolResult } from '../tools/helpers/ToolResult.ts'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.ts'

export interface DispatchPayload {
  toolCall: PendingToolCall
  userId: string
  config: Record<string, any>
  tempToRealIdMap: Record<string, string>
}

export class ToolDispatcherService {
  private router: Map<string, AbstractToolExecutor> = new Map()

  constructor(
    workspaceTools: WorkspaceToolsExecutorService,
    boardTools: BoardToolsExecutorService,
    categoryTools: CategoryToolsExecutorService,
    taskTools: TaskToolsExecutorService,
    generalTools: GeneralToolsExecutor,
  ) {
    this.registerExecutor(workspaceTools)
    this.registerExecutor(boardTools)
    this.registerExecutor(categoryTools)
    this.registerExecutor(taskTools)
    this.registerExecutor(generalTools)
  }

  private registerExecutor(executor: AbstractToolExecutor) {
    const toolNames = executor.getRegisteredToolNames()
    for (const name of toolNames) {
      if (this.router.has(name)) {
        throw new Error(`Duplicate tool registration: '${name}' is already registered.`)
      }
      this.router.set(name, executor)
    }
  }

  public async dispatch(payload: DispatchPayload): Promise<ToolResult> {
    const executor = this.router.get(payload.toolCall.name)

    if (!executor) {
      return new FailedToolResult(`Dispatcher Error: Unknown tool '${payload.toolCall.name}'`)
    }

    try {
      return await executor.executeTool(payload)
    } catch (error) {
      return new FailedToolResult(error instanceof Error ? error.message : String(error))
    }
  }
}
