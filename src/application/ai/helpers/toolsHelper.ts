import {
  createBaseTools,
  createBoardTools,
  createCategoryTools,
  createTaskTools,
  createWorkspaceTools,
} from '@application/ai/tools/tools.ts'
import { TaskToolAdapter } from '../tools/TaskToolAdapter.ts'
import { BoardToolAdapter } from '../tools/BoardToolAdapter.ts'
import { CategoryToolAdapter } from '../tools/CategoryToolAdapter.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { WorkspaceToolAdapter } from '../tools/WorkspaceToolAdapter.ts'

export function createTools(
  taskToolAdapter: TaskToolAdapter,
  boardToolAdapter: BoardToolAdapter,
  categoryToolAdapter: CategoryToolAdapter,
  workspaceToolAdapter: WorkspaceToolAdapter,
  operationLogService: OperationLogService
) {
  const entityTools = [
    ...createTaskTools(taskToolAdapter),
    ...createBoardTools(boardToolAdapter),
    ...createCategoryTools(categoryToolAdapter),
    ...createWorkspaceTools(workspaceToolAdapter),
  ]

  const hotTools = [...createBaseTools(operationLogService)]
  const allTools = [...entityTools, ...hotTools]
  const toolsWithIntegration = [...entityTools]

  const toolsByName = Object.fromEntries(
    [...entityTools, ...hotTools].map((tool) => [tool.name, tool])
  )
  const toolsWithIntegrationByName = Object.fromEntries(
    [...toolsWithIntegration].map((tool) => [tool.name, tool])
  )

  return {
    entityTools,
    hotTools,
    allTools,
    toolsByName,
    toolsWithIntegration,
    toolsWithIntegrationByName,
  }
}
