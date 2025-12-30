import {
  createBaseTools,
  createBoardTools,
  createCategoryTools,
  createTaskTools,
  createWorkspaceTools,
} from '@application/ai/tools/tools.ts'
import { TaskToolAdapter } from '@application/ai/tools/TaskToolAdapter.ts'
import { BoardToolAdapter } from '@application/ai/tools/BoardToolAdapter.ts'
import { CategoryToolAdapter } from '@application/ai/tools/CategoryToolAdapter.ts'
import { WorkspaceToolAdapter } from '@application/ai/tools/WorkspaceToolAdapter.ts'
import { BaseToolAdapter } from '@application/ai/tools/BaseToolAdapter.ts'

export function createTools(
  baseToolAdapter: BaseToolAdapter,
  taskToolAdapter: TaskToolAdapter,
  boardToolAdapter: BoardToolAdapter,
  categoryToolAdapter: CategoryToolAdapter,
  workspaceToolAdapter: WorkspaceToolAdapter
) {
  const entityTools = [
    ...createTaskTools(taskToolAdapter),
    ...createBoardTools(boardToolAdapter),
    ...createCategoryTools(categoryToolAdapter),
    ...createWorkspaceTools(workspaceToolAdapter),
  ]

  const baseTools = createBaseTools(baseToolAdapter)

  const hotTools = [...baseTools.filter((t) => t.name !== 'submitPlan')]
  const plannerTools = [...baseTools.filter((t) => t.name === 'submitPlan')]
  const allTools = [...entityTools, ...hotTools]
  const toolsWithIntegration = [...entityTools, baseTools.find((t) => t.name === 'undoOperations')!]

  const toolsByName = Object.fromEntries(
    [...entityTools, ...hotTools].map((tool) => [tool.name, tool])
  )
  const toolsWithIntegrationByName = Object.fromEntries(
    [...toolsWithIntegration].map((tool) => [tool.name, tool])
  )

  return {
    entityTools,
    hotTools,
    plannerTools,
    allTools,
    toolsByName,
    toolsWithIntegration,
    toolsWithIntegrationByName,
  }
}
