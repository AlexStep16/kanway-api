import IToolResult from '@/application/interfaces/IToolResult.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { LangGraphRunnableConfig } from 'node_modules/@langchain/langgraph/dist/pregel/runnable_types.js'
import { FailedToolResult } from '@application/ai/tools/FailedToolResult.ts'
import { SuccessToolResult } from '@application/ai/tools/SuccessToolResult.ts'
import { Configurable } from '../interfaces/Configurable.ts'

export class BaseToolAdapter {
  protected vectorSearchService: VectorSearchService
  protected operationLogService: OperationLogService
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    vectorSearchService: VectorSearchService,
    operationLogService: OperationLogService,
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
  ) {
    this.vectorSearchService = vectorSearchService
    this.operationLogService = operationLogService
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
    this.workspaceService = workspaceService
  }

  public async showEntitiesToUser(
    dto: {
      ids: string[]
      type: 'task' | 'category' | 'board' | 'workspace'
    },
    config: LangGraphRunnableConfig,
  ) {
    const { ids, type } = dto
    const configurable = config.configurable as Configurable
    const userId = configurable.user.id

    if (!Array.isArray(ids) || ids.length === 0) {
      return 'Invalid IDs.'
    }
    if (!['task', 'category', 'board', 'workspace'].includes(type)) {
      return 'Invalid type.'
    }

    let entities: any[] = []

    switch (type) {
      case 'task':
        entities = await this.taskService.getByCriteria({ ids }, userId)
        break
      case 'category':
        entities = await this.categoryService.getByCriteria({ ids }, userId)
        break
      case 'board':
        entities = await this.boardService.getByCriteria({ ids }, userId)
        break
      case 'workspace':
        entities = await this.workspaceService.getByCriteria({ ids }, userId)
        break
    }

    return entities
  }

  public async undoOperations(
    dto: { operationIds: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const operationIds = dto.operationIds
    const user = config.configurable?.user

    if (!Array.isArray(operationIds) || operationIds.length === 0) {
      return new FailedToolResult('Invalid operation IDs.')
    }

    const result = await this.operationLogService.undoOperations(operationIds, user)

    return new SuccessToolResult({
      undo: result,
    })
  }
}
