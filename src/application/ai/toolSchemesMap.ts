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
import { moveTaskScheme } from './tools/schemes/moveTaskScheme.ts'
import { moveCategoryScheme } from './tools/schemes/moveCategoryScheme.ts'
import { moveBoardScheme } from './tools/schemes/moveBoardScheme.ts'
import { moveWorkspaceScheme } from './tools/schemes/moveWorkspaceScheme.ts'
import { deleteTasksScheme } from './tools/schemes/deleteTasksScheme.ts'
import { deleteCategoriesScheme } from './tools/schemes/deleteCategoriesScheme.ts'
import { deleteBoardsScheme } from './tools/schemes/deleteBoardsScheme.ts'
import { deleteWorkspacesScheme } from './tools/schemes/deleteWorkspacesScheme.ts'
import { archiveTasksScheme } from './tools/schemes/archiveTasksScheme.ts'
import { archiveCategoriesScheme } from './tools/schemes/archiveCategoriesScheme.ts'
import { archiveBoardsScheme } from './tools/schemes/archiveBoardsScheme.ts'
import { archiveWorkspacesScheme } from './tools/schemes/archiveWorkspacesScheme.ts'
import { recoverTasksScheme } from './tools/schemes/recoverTasksScheme.ts'
import { recoverCategoriesScheme } from './tools/schemes/recoverCategoriesScheme.ts'
import { recoverBoardsScheme } from './tools/schemes/recoverBoardsScheme.ts'
import { recoverWorkspacesScheme } from './tools/schemes/recoverWorkspacesScheme.ts'
import { cloneTasksScheme } from './tools/schemes/cloneTasksScheme.ts'
import { cloneCategoriesScheme } from './tools/schemes/cloneCategoriesScheme.ts'
import { cloneBoardsScheme } from './tools/schemes/cloneBoardsScheme.ts'
import { cloneWorkspacesScheme } from './tools/schemes/cloneWorkspacesScheme.ts'
import { undoOperationScheme } from './tools/schemes/undoOperationScheme.ts'

export const toolSchemesMap = {
  search_tasks: searchTasksScheme,
  create_tasks: createTasksScheme,
  update_tasks: updateTasksScheme,
  move_task: moveTaskScheme,
  delete_tasks: deleteTasksScheme,
  archive_tasks: archiveTasksScheme,
  recover_tasks: recoverTasksScheme,
  clone_tasks: cloneTasksScheme,

  search_categories: searchCategoriesScheme,
  create_categories: createCategoriesScheme,
  update_categories: updateCategoriesScheme,
  move_category: moveCategoryScheme,
  delete_categories: deleteCategoriesScheme,
  archive_categories: archiveCategoriesScheme,
  recover_categories: recoverCategoriesScheme,
  clone_categories: cloneCategoriesScheme,

  search_boards: searchBoardsScheme,
  create_boards: createBoardsScheme,
  update_boards: updateBoardsScheme,
  move_board: moveBoardScheme,
  delete_boards: deleteBoardsScheme,
  archive_boards: archiveBoardsScheme,
  recover_boards: recoverBoardsScheme,
  clone_boards: cloneBoardsScheme,

  search_workspaces: searchWorkspacesScheme,
  create_workspaces: createWorkspacesScheme,
  update_workspaces: updateWorkspacesScheme,
  move_workspace: moveWorkspaceScheme,
  delete_workspaces: deleteWorkspacesScheme,
  archive_workspaces: archiveWorkspacesScheme,
  recover_workspaces: recoverWorkspacesScheme,
  clone_workspaces: cloneWorkspacesScheme,

  undo_operation: undoOperationScheme,
  display_to_user: displayToUserScheme,
  resolve_ambiguous: resolveAmbiguousScheme,
}
