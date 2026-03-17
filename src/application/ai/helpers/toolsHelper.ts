import { createBaseTools } from '@application/ai/tools/baseTools.ts'
import { createPlannerTools } from '@application/ai/tools/plannerTools.ts'
import { createExecutorTools } from '@application/ai/tools/executorTools.ts'
import { BaseToolAdapter } from '@/application/ai/tools/adapters/BaseToolAdapter.ts'
import { TaskBaseToolAdapter } from '../tools/adapters/tasks/TaskBaseToolAdapter.ts'
import { TaskEditToolAdapter } from '../tools/adapters/tasks/TaskEditToolAdapter.ts'
import { CategoryEditToolAdapter } from '../tools/adapters/categories/CategoryEditToolAdapter.ts'
import { CategoryBaseToolAdapter } from '../tools/adapters/categories/CategoryBaseToolAdapter.ts'
import { BoardEditToolAdapter } from '../tools/adapters/boards/BoardEditToolAdapter.ts'
import { BoardBaseToolAdapter } from '../tools/adapters/boards/BoardBaseToolAdapter.ts'
import { WorkspaceBaseToolAdapter } from '../tools/adapters/workspaces/WorkspaceBaseToolAdapter.ts'
import { WorkspaceEditToolAdapter } from '../tools/adapters/workspaces/WorkspaceEditToolAdapter.ts'
import { createBaseTaskTools } from '../tools/tasks/taskBaseTools.ts'
import { createBaseBoardTools } from '../tools/boards/boardBaseTools.ts'
import { createEditTaskTools } from '../tools/tasks/taskEditTools.ts'
import { createEditWorkspaceTools } from '../tools/workspaces/workspaceEditTools.ts'
import { createEditBoardTools } from '../tools/boards/boardEditTools.ts'
import { createBaseWorkspaceTools } from '../tools/workspaces/workspaceBaseTool.ts'
import { createEditCategoryTools } from '../tools/categories/categoryEditTools.ts'
import { createBaseCategoryTools } from '../tools/categories/categoryBaseTools.ts'

export function createTools(
  baseToolAdapter: BaseToolAdapter,
  taskBaseToolAdapter: TaskBaseToolAdapter,
  taskEditToolAdapter: TaskEditToolAdapter,
  boardBaseToolAdapter: BoardBaseToolAdapter,
  boardEditToolAdapter: BoardEditToolAdapter,
  categoryBaseToolAdapter: CategoryBaseToolAdapter,
  categoryEditToolAdapter: CategoryEditToolAdapter,
  workspaceBaseToolAdapter: WorkspaceBaseToolAdapter,
  workspaceEditToolAdapter: WorkspaceEditToolAdapter,
) {
  const entityTools = [
    ...createBaseTaskTools(taskBaseToolAdapter),
    ...createEditTaskTools(taskEditToolAdapter),
    ...createBaseBoardTools(boardBaseToolAdapter),
    ...createEditBoardTools(boardEditToolAdapter),
    ...createBaseCategoryTools(categoryBaseToolAdapter),
    ...createEditCategoryTools(categoryEditToolAdapter),
    ...createBaseWorkspaceTools(workspaceBaseToolAdapter),
    ...createEditWorkspaceTools(workspaceEditToolAdapter),
  ]

  const baseTools = createBaseTools(baseToolAdapter)
  const executorTools = createExecutorTools(baseToolAdapter)
  const plannerTools = createPlannerTools()

  const allTools = [...entityTools, ...executorTools, ...plannerTools, ...baseTools]
  const toolsWithOperationLog = [
    ...entityTools,
    executorTools.find((t) => t.name === 'undoOperations')!,
  ]
  const toolsWithUpdatedArgs = [
    entityTools.find((t) =>
      ['createTasks', 'createCategories', 'createBoards', 'createWorkspaces'].includes(t.name),
    ),
  ]

  const toolsByName = Object.fromEntries(allTools.map((tool) => [tool.name, tool]))
  const toolsWithOperationLogByName = Object.fromEntries(
    [...toolsWithOperationLog].map((tool) => [tool.name, tool]),
  )

  const toolsWithActionsByName = Object.fromEntries(
    [...entityTools].map((tool) => [tool.name, tool]),
  )

  const toolsWithUpdatedArgsByName = Object.fromEntries(
    [...toolsWithUpdatedArgs].map((tool) => [tool!.name, tool!]),
  )

  return {
    entityTools,
    executorTools,
    plannerTools,
    allTools,
    toolsByName,
    toolsWithOperationLogByName,
    toolsWithOperationLog,
    toolsWithActionsByName,
    toolsWithUpdatedArgsByName,
  }
}
