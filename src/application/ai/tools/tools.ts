import { tool } from '@langchain/core/tools'
import * as z from 'zod'
import {
  BoardCreateSchema,
  CategoryCreateSchema,
  BoardFilterSchema,
  CategoryFilterSchema,
  TaskFilterSchema,
  WorkspaceFilterSchema,
  EditBoardsSchema,
  EditCategoriesSchema,
  EditTasksSchema,
  EditWorkspacesSchema,
  Plan,
  TaskCreateSchema,
  WorkspaceCreateSchema,
  PlanToolSchema,
  ShowEntitiesToUserSchema,
} from './toolSchemes.ts'
import { TaskToolAdapter } from '@application/ai/tools/TaskToolAdapter.ts'
import { CategoryToolAdapter } from '@application/ai/tools/CategoryToolAdapter.ts'
import { BoardToolAdapter } from '@application/ai/tools/BoardToolAdapter.ts'
import { WorkspaceToolAdapter } from '@application/ai/tools/WorkspaceToolAdapter.ts'
import { BaseToolAdapter } from './BaseToolAdapter.ts'

export function createCategoryTools(adapter: CategoryToolAdapter) {
  const findCategoriesByFilter = tool(
    (filter, config) => adapter.findCategoriesByFilter(filter, config),
    {
      name: 'findCategoriesByFilter',
      schema: CategoryFilterSchema,
    }
  )

  const findRelevantCategories = tool(
    ({ nameToFind }, config) => adapter.findRelevantCategories({ nameToFind }, config),
    {
      name: 'findRelevantCategories',
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createCategories = tool((data, config) => adapter.createCategories(data, config), {
    name: 'createCategories',
    schema: CategoryCreateSchema,
  })

  const editCategories = tool((args, config) => adapter.editCategories(args, config), {
    name: 'editCategories',
    schema: EditCategoriesSchema,
  })

  const archiveCategories = tool((args, config) => adapter.archiveCategories(args, config), {
    name: 'archiveCategories',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID категорий для архивирования.'),
    }),
  })

  const recoverCategories = tool((args, config) => adapter.recoverCategories(args, config), {
    name: 'recoverCategories',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID категорий для восстановления.'),
    }),
  })

  const deleteCategories = tool((args, config) => adapter.deleteCategories(args, config), {
    name: 'deleteCategories',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID категорий для удаления.'),
    }),
  })

  return [
    findCategoriesByFilter,
    findRelevantCategories,
    createCategories,
    editCategories,
    archiveCategories,
    recoverCategories,
    deleteCategories,
  ]
}

export function createBoardTools(adapter: BoardToolAdapter) {
  const findBoardsByFilter = tool((filter, config) => adapter.findBoardsByFilter(filter, config), {
    name: 'findBoardsByFilter',
    schema: BoardFilterSchema,
  })

  const findRelevantBoards = tool(
    ({ nameToFind }, config) => adapter.findRelevantBoards({ nameToFind }, config),
    {
      name: 'findRelevantBoards',
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createBoards = tool((data, config) => adapter.createBoards(data, config), {
    name: 'createBoards',
    schema: BoardCreateSchema,
  })

  const editBoards = tool((args, config) => adapter.editBoards(args, config), {
    name: 'editBoards',
    schema: EditBoardsSchema,
  })

  const archiveBoards = tool((args, config) => adapter.archiveBoards(args, config), {
    name: 'archiveBoards',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID досок для архивирования.'),
    }),
  })

  const recoverBoards = tool((args, config) => adapter.recoverBoards(args, config), {
    name: 'recoverBoards',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID досок для восстановления.'),
    }),
  })

  const deleteBoards = tool((args, config) => adapter.deleteBoards(args, config), {
    name: 'deleteBoards',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID досок для удаления.'),
    }),
  })

  return [
    findBoardsByFilter,
    findRelevantBoards,
    createBoards,
    editBoards,
    archiveBoards,
    recoverBoards,
    deleteBoards,
  ]
}

export function createWorkspaceTools(adapter: WorkspaceToolAdapter) {
  const findWorkspacesByFilter = tool(
    (filter, config) => adapter.findWorkspacesByFilter(filter, config),
    {
      name: 'findWorkspacesByFilter',
      schema: WorkspaceFilterSchema,
    }
  )

  const findRelevantWorkspaces = tool(
    ({ nameToFind }, config) => adapter.findRelevantWorkspaces({ nameToFind }, config),
    {
      name: 'findRelevantWorkspaces',
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createWorkspaces = tool((data, config) => adapter.createWorkspaces(data, config), {
    name: 'createWorkspaces',
    schema: WorkspaceCreateSchema,
  })

  const editWorkspaces = tool((args, config) => adapter.editWorkspaces(args, config), {
    name: 'editWorkspaces',
    schema: EditWorkspacesSchema,
  })

  const archiveWorkspaces = tool((args, config) => adapter.archiveWorkspaces(args, config), {
    name: 'archiveWorkspaces',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID пространств для архивирования.'),
    }),
  })

  const recoverWorkspaces = tool((args, config) => adapter.recoverWorkspaces(args, config), {
    name: 'recoverWorkspaces',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID пространств для восстановления.'),
    }),
  })

  const deleteWorkspaces = tool((args, config) => adapter.deleteWorkspaces(args, config), {
    name: 'deleteWorkspaces',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID пространств для удаления.'),
    }),
  })

  return [
    findWorkspacesByFilter,
    findRelevantWorkspaces,
    createWorkspaces,
    editWorkspaces,
    archiveWorkspaces,
    recoverWorkspaces,
    deleteWorkspaces,
  ]
}

export function createTaskTools(adapter: TaskToolAdapter) {
  const findTasksByFilter = tool((args, config) => adapter.findTasksByFilter(args, config), {
    name: 'findTasksByFilter',
    schema: TaskFilterSchema,
  })

  const findRelevantTasks = tool(
    ({ nameToFind }, config) => adapter.findRelevantTasks({ nameToFind }, config),
    {
      name: 'findRelevantTasks',
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createTasks = tool((data, config) => adapter.createTasks(data, config), {
    name: 'createTasks',
    schema: TaskCreateSchema,
  })

  const editTasks = tool((args, config) => adapter.editTasks(args, config), {
    name: 'editTasks',
    schema: EditTasksSchema,
  })

  const archiveTasks = tool((args, config) => adapter.archiveTasks(args, config), {
    name: 'archiveTasks',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID задач для архивирования.'),
    }),
  })

  const recoverTasks = tool((args, config) => adapter.recoverTasks(args, config), {
    name: 'recoverTasks',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID задач для восстановления.'),
    }),
  })

  const deleteTasks = tool((args, config) => adapter.deleteTasks(args, config), {
    name: 'deleteTasks',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID задач для удаления.'),
    }),
  })

  return [
    findTasksByFilter,
    findRelevantTasks,
    createTasks,
    editTasks,
    archiveTasks,
    recoverTasks,
    deleteTasks,
  ]
}

export function createBaseTools(adapter: BaseToolAdapter) {
  const showEntitiesToUser = tool(
    async (data, config) => await adapter.showEntitiesToUser(data, config),
    {
      name: 'showEntitiesToUser',
      description: 'Shows entities to the user by their IDs and types.',
      schema: ShowEntitiesToUserSchema,
    }
  )

  const undoOperations = tool(async (data, config) => adapter.undoOperations(data, config), {
    name: 'undoOperations',
    description:
      'Use this tool to undo a set of operations previously performed. Provide the IDs of the operations you wish to revert.',
    schema: z.object({
      operationIds: z.array(z.string()).describe('IDs of the operations to undo'),
    }),
  })

  const getRelevantTools = tool(
    async () => {
      return
    },
    {
      name: 'getRelevantTools',
      description: 'Internal tool for self-analysis. Use it to expand your set of tools.',
      schema: Plan,
    }
  )

  const finishResponse = tool(
    async () => {
      return
    },
    {
      name: 'finishResponse',
      description:
        'FINAL TOOL. Call this to deliver the answer to the user. Input "response" must be a string in Markdown. You CANNOT speak without this tool.',
      schema: z.object({
        response: z.string().describe('The final response to the user.'),
      }),
    }
  )

  const submitPlan = tool(
    async () => {
      return
    },
    {
      name: 'submitPlan',
      schema: PlanToolSchema,
    }
  )

  return [showEntitiesToUser, undoOperations, getRelevantTools, finishResponse, submitPlan]
}
