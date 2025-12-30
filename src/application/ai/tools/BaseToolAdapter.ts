import IToolResult from '@/application/interfaces/IToolResult.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { BaseService } from '@application/services/BaseService.ts'
import { LangGraphRunnableConfig } from 'node_modules/@langchain/langgraph/dist/pregel/runnable_types.js'
import { FailedToolResult } from '@application/ai/tools/FailedToolResult.ts'
import { SuccessToolResult } from '@application/ai/tools/SuccessToolResult.ts'

export class BaseToolAdapter {
  protected baseService: BaseService
  protected operationLogService: OperationLogService
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    baseService: BaseService,
    operationLogService: OperationLogService,
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService
  ) {
    this.baseService = baseService
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
    config: LangGraphRunnableConfig
  ) {
    const { ids, type } = dto
    const userId = config.configurable?.user?.id

    if (!Array.isArray(ids) || ids.length === 0) {
      return 'Invalid IDs.'
    }
    if (!['task', 'category', 'board', 'workspace'].includes(type)) {
      return 'Invalid type.'
    }

    let entities: any[] = []

    switch (type) {
      case 'task':
        entities = await this.taskService.getAll({ ids }, userId)
        break
      case 'category':
        entities = await this.categoryService.getAll({ ids }, userId)
        break
      case 'board':
        entities = await this.boardService.getAll({ ids }, userId)
        break
      case 'workspace':
        entities = await this.workspaceService.getAll({ ids }, userId)
        break
    }

    return JSON.stringify(entities)
  }

  public async undoOperations(
    dto: { operationIds: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const operationIds = dto.operationIds
    const user = config.configurable?.user

    if (!Array.isArray(operationIds) || operationIds.length === 0) {
      return new FailedToolResult('Invalid operation IDs.')
    }

    const result = await this.operationLogService.undoOperations(operationIds, user)
    const combinedResult = await this.operationLogService.combineUndoResult(result)

    const dataWithIntegration = {
      data: 'Operations undone successfully.',
      integration: combinedResult,
    }

    return new SuccessToolResult(dataWithIntegration)
  }
}
