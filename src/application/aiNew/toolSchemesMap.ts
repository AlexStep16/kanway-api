import { searchTasksScheme } from './tools/schemes/searchTasksScheme.ts'
import { displayToUserScheme } from './tools/schemes/displayToUserScheme.ts'
import { searchCategoriesScheme } from './tools/schemes/searchCategoriesScheme.ts'
import { searchBoardsScheme } from './tools/schemes/searchBoardsScheme.ts'
import { resolveAmbiguousScheme } from './tools/schemes/resolveAmbiguousScheme.ts'
import { createTasksScheme } from './tools/schemes/createTasksScheme.ts'
import { updateTasksScheme } from './tools/schemes/updateTasksScheme.ts'
import { updateCategoriesScheme } from './tools/schemes/updateCategoriesScheme.ts'
import { createCategoriesScheme } from './tools/schemes/createCategoriesScheme.ts'
import { updateBoardsScheme } from './tools/schemes/updateBoardsScheme.ts'
import { createBoardsScheme } from './tools/schemes/createBoardsScheme.ts'
import { searchWorkspacesScheme } from './tools/schemes/searchWorkspacesScheme.ts'
import { createWorkspacesScheme } from './tools/schemes/createWorkspacesScheme.ts'
import { updateWorkspacesScheme } from './tools/schemes/updateWorkspacesScheme.ts'

export const toolSchemesMap = {
  search_tasks: searchTasksScheme,
  create_tasks: createTasksScheme,
  update_tasks: updateTasksScheme,

  search_categories: searchCategoriesScheme,
  create_categories: createCategoriesScheme,
  update_categories: updateCategoriesScheme,

  search_boards: searchBoardsScheme,
  create_boards: createBoardsScheme,
  update_boards: updateBoardsScheme,

  search_workspaces: searchWorkspacesScheme,
  create_workspaces: createWorkspacesScheme,
  update_workspaces: updateWorkspacesScheme,

  display_to_user: displayToUserScheme,
  resolve_ambiguous: resolveAmbiguousScheme,
}
