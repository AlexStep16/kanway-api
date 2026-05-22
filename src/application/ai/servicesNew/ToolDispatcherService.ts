import { AbstractToolExecutor } from './AbstractToolExecutor.js'
import { PendingToolCall } from '../agent/AgentStateAnnotation.js'
import { GeneralToolsExecutor } from './GeneralToolsExecutor.js'
import { TaskToolsExecutorService } from './TaskToolsExecutorService.js'
import { CategoryToolsExecutorService } from './CategoryToolsExecutorService.js'
import { WorkspaceToolsExecutorService } from './WorkspaceToolsExecutorService.js'
import { BoardToolsExecutorService } from './BoardToolsExecutorService.js'
import { ToolResult } from '../tools/helpers/ToolResult.js'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.js'
import { RunnableConfig } from '@langchain/core/runnables'

export interface DispatchPayload {
  toolCall: PendingToolCall
  userId: string
  config: RunnableConfig
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
      console.error(error)
      return new FailedToolResult(error instanceof Error ? error.message : String(error))
    }
  }
}
