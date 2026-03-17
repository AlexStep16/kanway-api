import { categoryScheme } from './entities/schemes/categoryScheme.ts'
import { taskScheme } from './entities/schemes/taskScheme.ts'
import { boardScheme } from './entities/schemes/boardScheme.ts'
import { workspaceScheme } from './entities/schemes/workspaceScheme.ts'

export const entitySchemesMap = {
  task: taskScheme,
  category: categoryScheme,
  board: boardScheme,
  workspace: workspaceScheme,
}
