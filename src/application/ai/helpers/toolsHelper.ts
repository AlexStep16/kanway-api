import {
  findTasksByFilter,
  findCategoriesByFilter,
  findBoardsByFilter,
  findWorkspacesByFilter,
  findRelevantTasks,
  findRelevantCategories,
  findRelevantBoards,
  findRelevantWorkspaces,
  createTasks,
  createCategories,
  createBoards,
  createWorkspaces,
  editTasks,
  editCategories,
  editBoards,
  editWorkspaces,
  archiveWorkspaces,
  archiveBoards,
  archiveCategories,
  archiveTasks,
  recoverWorkspaces,
  recoverBoards,
  recoverCategories,
  recoverTasks,
  deleteWorkspaces,
  deleteBoards,
  deleteCategories,
  deleteTasks,
  getChatHistory,
  getRelevantTools,
  undoOperations,
  finishResponse,
} from '@application/ai/tools/tools.ts'

export const tools = [
  findTasksByFilter,
  findCategoriesByFilter,
  findBoardsByFilter,
  findWorkspacesByFilter,

  findRelevantTasks,
  findRelevantCategories,
  findRelevantBoards,
  findRelevantWorkspaces,

  createTasks,
  createCategories,
  createBoards,
  createWorkspaces,

  editTasks,
  editCategories,
  editBoards,
  editWorkspaces,

  archiveWorkspaces,
  archiveBoards,
  archiveCategories,
  archiveTasks,

  recoverWorkspaces,
  recoverBoards,
  recoverCategories,
  recoverTasks,

  deleteWorkspaces,
  deleteBoards,
  deleteCategories,
  deleteTasks,
]

export const hotTools = [getRelevantTools, getChatHistory, undoOperations, finishResponse]
export const toolsWithOperationLogs = [
  createTasks,
  createBoards,
  createCategories,
  createWorkspaces,

  editWorkspaces,
  editCategories,
  editBoards,
  editTasks,

  archiveTasks,
  archiveCategories,
  archiveBoards,
  archiveWorkspaces,

  recoverTasks,
  recoverCategories,
  recoverBoards,
  recoverWorkspaces,

  deleteTasks,
  deleteCategories,
  deleteBoards,
  deleteWorkspaces,
]

export const toolsByName = Object.fromEntries(
  [...tools, ...hotTools].map((tool) => [tool.name, tool])
)
export const toolsWithOperationLogsByName = Object.fromEntries(
  [...toolsWithOperationLogs].map((tool) => [tool.name, tool])
)
