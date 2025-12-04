import { filterToMongoQuery } from '@/infrastructure/ai/filterToMongoQuery.ts'
import { tool } from '@langchain/core/tools'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { Types } from 'mongoose'
import * as z from 'zod'
import { validateFilter } from '../helpers/validateFilter.ts'
import { getFilterNameField } from '../helpers/getFilterNameField.ts'
import {
  boardFieldsSchema,
  categoryFieldsSchema,
  ConditionalBoardFilterSchema,
  ConditionalCategoryFilterSchema,
  ConditionalTaskFilterSchema,
  ConditionalWorkspaceFilterSchema,
  editBoardsSchema,
  editCategoriesSchema,
  editTasksSchema,
  editWorkspacesSchema,
  FinishResponseSchema,
  GetChatHistorySchema,
  Plan,
  taskCreateFieldsSchema,
  workspaceFieldsSchema,
} from './toolSchemes.ts'

const findTasksByFilter = tool(
  async (filter, config: LangGraphRunnableConfig) => {
    /**
     * Find tasks by filter.
     */

    const userId = config.configurable?.user_id
    const timezone = config.configurable?.timezone || 'Europe/Moscow'
    let mongoFilter: any = {}

    const errorMsgs = await validateFilter(filter, 'task', userId)

    if (errorMsgs.length > 0) {
      return 'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
    }

    try {
      mongoFilter = await filterToMongoQuery(filter, timezone, 'task')
    } catch (e) {
      return `Error converting filter to MongoDB query: ${(e as Error).message}`
    }

    if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

    mongoFilter.user_id = Types.ObjectId.createFromHexString(userId)

    const tasks = await TaskController.getTasksByFilter(
      mongoFilter,
      '-embeddings -__v -due_hours -due_minutes',
      30
    )

    if (tasks.length === 0) {
      const filterNameField = getFilterNameField(mongoFilter)

      if (filterNameField) {
        // If no tasks found but filter includes 'name', try semantic search as fallback
        const semanticSearchResults = await BaseController.similaritySearchTasks(
          filterNameField,
          userId,
          2
        )
        return (
          `No exact matches found. Here are some tasks that might be relevant based on the name "${filterNameField}":\n` +
          JSON.stringify(semanticSearchResults)
        )
      }
    }

    return JSON.stringify(tasks)
  },
  {
    name: 'findTasksByFilter',
    description:
      "Используй, чтобы найти одну или несколько задач по их свойствам (названию, статусу, дате). Это необходимо, чтобы затем изменить, архивировать, удалить или просто проверить информацию о задаче. Применяй, когда пользователь говорит 'найди задачу...' или 'что со статусом задачи...'",
    schema: ConditionalTaskFilterSchema,
  }
)

// region: 1. FIND BY FILTER
// =================================================================

const findCategoriesByFilter = tool(
  async (filter, config: LangGraphRunnableConfig) => {
    /**
     * Find categories by filter.
     */

    const userId = config.configurable?.user_id
    const timezone = config.configurable?.timezone || 'Europe/Moscow'
    let mongoFilter: any = {}

    const errorMsgs = await validateFilter(filter, 'category', userId)

    if (errorMsgs.length > 0) {
      return 'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
    }

    try {
      mongoFilter = await filterToMongoQuery(filter, timezone, 'category')
    } catch (e) {
      return `Error converting filter to MongoDB query: ${(e as Error).message}`
    }

    if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

    mongoFilter.is_deleted = false
    mongoFilter.user_id = Types.ObjectId.createFromHexString(userId)

    const categories = await CategoryController.getCategoriesByFilter(
      mongoFilter,
      '-embeddings -__v',
      30
    )

    if (categories.length === 0) {
      const filterNameField = getFilterNameField(mongoFilter)

      if (filterNameField) {
        // If no categories found but filter includes 'name', try semantic search as fallback
        const semanticSearchResults = await BaseController.similaritySearchCategories(
          filterNameField,
          userId,
          2
        )
        return (
          `No exact matches found. Here are some categories that might be relevant based on the name "${filterNameField}":\n` +
          JSON.stringify(semanticSearchResults)
        )
      }
    }

    return JSON.stringify(categories)
  },
  {
    name: 'findCategoriesByFilter',
    description:
      'Используй этот инструмент, чтобы найти одну или несколько категорий по ее названию или другим атрибутам. Это необходимый шаг перед созданием задачи в конкретной категории или перед перемещением задачи в нее.',
    schema: ConditionalCategoryFilterSchema,
  }
)

const findBoardsByFilter = tool(
  async (filter, config: LangGraphRunnableConfig) => {
    /**
     * Find boards by filter.
     */

    const userId = config.configurable?.user_id
    const timezone = config.configurable?.timezone || 'Europe/Moscow'
    let mongoFilter: any = {}

    const errorMsgs = await validateFilter(filter, 'board', userId)

    if (errorMsgs.length > 0) {
      return 'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
    }

    try {
      mongoFilter = await filterToMongoQuery(filter, timezone, 'board')
    } catch (e) {
      return `Error converting filter to MongoDB query: ${(e as Error).message}`
    }

    if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

    mongoFilter.is_deleted = false
    mongoFilter.user_id = Types.ObjectId.createFromHexString(userId)

    const boards = await BoardController.getBoardsByFilter(mongoFilter, '-embeddings -__v', 30)

    if (boards.length === 0) {
      const filterNameField = getFilterNameField(mongoFilter)

      if (filterNameField) {
        // If no boards found but filter includes 'name', try semantic search as fallback
        const semanticSearchResults = await BaseController.similaritySearchBoards(
          filterNameField,
          userId,
          2
        )
        return (
          `No exact matches found. Here are some boards that might be relevant based on the name "${filterNameField}":\n` +
          JSON.stringify(semanticSearchResults)
        )
      }
    }

    return JSON.stringify(boards)
  },
  {
    name: 'findBoardsByFilter',
    description:
      'Используй, чтобы найти одну или несколько досок по её названию, порядку, архивированию, пространству. Это нужно, чтобы создавать в ней категории, перемещать в нее задачи или изменять саму доску. Обязательный шаг, если ID доски не предоставлен явно.',
    schema: ConditionalBoardFilterSchema,
  }
)

const findWorkspacesByFilter = tool(
  async (filter, config: LangGraphRunnableConfig) => {
    /**
     * Find workspaces by filter.
     */

    const userId = config.configurable?.user_id
    const timezone = config.configurable?.timezone || 'Europe/Moscow'
    let mongoFilter: any = {}

    const errorMsgs = await validateFilter(filter, 'workspace', userId)

    if (errorMsgs.length > 0) {
      return 'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
    }

    try {
      mongoFilter = await filterToMongoQuery(filter, timezone, 'workspace')
    } catch (e) {
      return `Error converting filter to MongoDB query: ${(e as Error).message}`
    }

    if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

    mongoFilter.is_deleted = false
    mongoFilter.user_id = Types.ObjectId.createFromHexString(userId)

    const workspaces = await WorkspaceController.getWorkspacesByFilter(
      mongoFilter,
      '-embeddings -__v',
      30
    )

    if (workspaces.length === 0) {
      const filterNameField = getFilterNameField(mongoFilter)

      if (filterNameField) {
        // If no workspaces found but filter includes 'name', try semantic search as fallback
        const semanticSearchResults = await BaseController.similaritySearchWorkspaces(
          filterNameField,
          userId,
          2
        )
        return (
          `No exact matches found. Here are some workspaces that might be relevant based on the name "${filterNameField}":\n` +
          JSON.stringify(semanticSearchResults)
        )
      }
    }

    return JSON.stringify(workspaces)
  },
  {
    name: 'findWorkspacesByFilter',
    description:
      'Используй, чтобы найти одно или несколько рабочих пространств по его названию, порядку или архивированию. Это необходимо для создания в нем досок или для его изменения, если ID не известен.',
    schema: ConditionalWorkspaceFilterSchema,
  }
)
// =================================================================
// endregion

// region: 2. FIND RELEVANT
// =================================================================
const findRelevantCategories = tool(
  async ({ name_to_find }, config: LangGraphRunnableConfig) => {
    if (!name_to_find) {
      return 'Task name required to find relevant categories.'
    }

    const userId = config.configurable?.user_id

    const categories = await BaseController.similaritySearchCategories(name_to_find, userId, 10)

    return JSON.stringify(
      categories.map((category) => ({
        id: category._id.toString(),
        name: category.name,
      }))
    )
  },
  {
    name: 'findRelevantCategories',
    description:
      "Применяй, когда пользователь просит найти 'похожие категории', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findCategoriesByFilter, который ищет по точным критериям.",
    schema: z.object({
      name_to_find: z.string(),
    }),
  }
)

const findRelevantTasks = tool(
  async ({ nameToFind }, config: LangGraphRunnableConfig) => {
    if (!nameToFind) {
      return 'Task name required to find relevant tasks.'
    }

    const userId = config.configurable?.user_id

    const tasks = await BaseController.similaritySearchTasks(
      nameToFind,
      BaseController.getValidTypes.ObjectId(userId),
      20
    )

    return JSON.stringify(
      tasks.map((task) => ({
        id: task._id.toString(),
        name: task.name,
      }))
    )
  },
  {
    name: 'findRelevantTasks',
    description:
      "Применяй, когда пользователь просит найти 'похожие задачи', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findTasksByFilter, который ищет по точным критериям.",
    schema: z.object({
      nameToFind: z.string(),
    }),
  }
)

const findRelevantBoards = tool(
  async ({ name_to_find }, config: LangGraphRunnableConfig) => {
    if (!name_to_find) {
      return 'Board name required to find relevant tasks.'
    }

    const userId = config.configurable?.user_id

    const boards = await BaseController.similaritySearchBoards(
      name_to_find,
      BaseController.getValidTypes.ObjectId(userId),
      10
    )

    return JSON.stringify(
      boards.map((board) => ({
        id: board._id.toString(),
        name: board.name,
      }))
    )
  },
  {
    name: 'findRelevantBoards',
    description:
      "Применяй, когда пользователь просит найти 'похожие доски', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findBoardsByFilter, который ищет по точным критериям.",
    schema: z.object({
      name_to_find: z.string(),
    }),
  }
)

const findRelevantWorkspaces = tool(
  async ({ name_to_find }, config: LangGraphRunnableConfig) => {
    if (!name_to_find) {
      return 'Board name required to find relevant tasks.'
    }

    const userId = config.configurable?.user_id

    const workspaces = await BaseController.similaritySearchWorkspaces(
      name_to_find,
      BaseController.getValidTypes.ObjectId(userId),
      10
    )

    return JSON.stringify(
      workspaces.map((workspace) => ({
        id: workspace._id.toString(),
        name: workspace.name,
      }))
    )
  },
  {
    name: 'findRelevantWorkspaces',
    description:
      "Применяй, когда пользователь просит найти 'похожие рабочие пространства', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findWorkspacesByFilter, который ищет по точным критериям.",
    schema: z.object({
      name_to_find: z.string(),
    }),
  }
)
// =================================================================
// endregion

// region: 3. CREATION
// =================================================================
const createTasks = tool(
  async (data, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const userId = config.configurable?.user_id
    const threadId = config.configurable?.thread_id
    const tasks = data.tasks

    const errors = await TaskValidator.validate(tasks, userId, ['name', 'category_id'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: `Tasks creation failed:\n${errors.join('\n')}`,
        result: null,
      }
    }

    const tasksResult = await TaskController.createTasksHandler(tasks as ITask[], userId, threadId)

    if (!tasksResult) {
      return {
        success: false,
        errorMsg: 'Tasks creation failed.',
        result: null,
      }
    }

    if (tasksResult.result && tasksResult.result.length === 0) {
      return {
        success: false,
        errorMsg: 'No tasks were created.',
        result: null,
      }
    } else if (!tasksResult.result) {
      return {
        success: false,
        errorMsg: 'Tasks creation failed.',
        result: null,
      }
    }

    return {
      success: true,
      errorMsg: null,
      result: tasksResult,
    }
  },
  {
    name: 'createTasks',
    description:
      'Основной инструмент для создания одной или нескольких новых задач. Всегда требует название задачи. Для создания задачи в определенной категории, сначала используй findCategoriesByFilter, чтобы получить category_id.',
    schema: z.object({
      tasks: z.array(taskCreateFieldsSchema),
    }),
  }
)

const createCategories = tool(
  async (data, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    /**
     * Create new categories.
     */
    const threadId = config.configurable?.thread_id
    const userId = config.configurable?.user_id

    const categories = data.categories

    const errors = await CategoryValidator.validate(categories, userId, ['name', 'board_id'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: `Categories creation failed: ${errors.join(', ')}`,
        result: null,
      }
    }

    const categoriesResult = await CategoryController.createCategoriesHandler(
      categories as ICategory[],
      userId,
      threadId
    )

    if (!categoriesResult || !categoriesResult.result) {
      return {
        success: false,
        errorMsg: 'Categories creation failed.',
        result: null,
      }
    }

    if (categoriesResult.result.length === 0) {
      return {
        success: false,
        errorMsg: 'No categories were created.',
        result: null,
      }
    }

    return {
      success: true,
      errorMsg: null,
      result: categoriesResult,
    }
  },
  {
    name: 'createCategories',
    description:
      'Применяй для создания новых категорий (колонок) на доске. Всегда требует название категории и board_id. Если board_id неизвестен, используй текущий активный ID или найди его с помощью findBoardsByFilter.',
    schema: z.object({ categories: z.array(categoryFieldsSchema) }),
  }
)

const createBoards = tool(
  async (data, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    /**
     * Create new boards.
     */
    const threadId = config.configurable?.thread_id
    const userId = config.configurable?.user_id

    const boards = data.boards

    const errors = await BoardValidator.validate(boards, userId, ['name', 'workspace_id'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: `Boards creation failed: ${errors.join(', ')}`,
        result: null,
      }
    }

    const boardsResult = await BoardController.createBoardsHandler(
      boards as IBoard[],
      userId,
      threadId
    )

    if (!boardsResult || !boardsResult.result) {
      return {
        success: false,
        errorMsg: 'Boards creation failed: Invalid board data.',
        result: null,
      }
    }
    if (boardsResult.result.length === 0) {
      return {
        success: false,
        errorMsg: 'No boards were created.',
        result: null,
      }
    }

    return {
      success: true,
      errorMsg: null,
      result: boardsResult,
    }
  },
  {
    name: 'createBoards',
    description:
      'Применяй для создания новых досок. Всегда требует название доски и workspace_id. Если workspace_id неизвестен, используй текущий активный ID или найди его с помощью findWorkspacesByFilter.',
    schema: z.object({ boards: z.array(boardFieldsSchema) }),
  }
)

const createWorkspaces = tool(
  async (data, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    /**
     * Create new workspaces.
     */
    const threadId = config.configurable?.thread_id
    const userId = config.configurable?.user_id

    const workspaces = data.workspaces

    const errors = await WorkspaceValidator.validate(workspaces, userId, ['name'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: `Workspaces creation failed: ${errors.join(', ')}`,
        result: null,
      }
    }

    const workspacesResult = await WorkspaceController.createWorkspacesHandler(
      workspaces as IWorkspace[],
      userId,
      threadId
    )

    if (!workspacesResult || !workspacesResult.result) {
      return {
        success: false,
        errorMsg: 'Workspaces creation failed: Invalid workspace data.',
        result: null,
      }
    }
    if (workspacesResult.result.length === 0) {
      return {
        success: false,
        errorMsg: 'No workspaces were created.',
        result: null,
      }
    }

    return {
      success: true,
      errorMsg: null,
      result: workspacesResult,
    }
  },
  {
    name: 'createWorkspaces',
    description:
      'Применяй для создания новых рабочих пространств. Всегда требует название рабочего пространства.',
    schema: z.object({ workspaces: z.array(workspaceFieldsSchema) }),
  }
)
// =================================================================
// endregion

// region: 4. EDIT
// =================================================================

const editTasks = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id
    const timezone = config.configurable?.timezone || 'Europe/Moscow'

    const totalErrors = []

    const filterErrors = await TaskValidator.validate([args.filter], user_id, ['_ids'])

    const changeErrors = await TaskValidator.validateChanges(args.changes, user_id)

    if (filterErrors.length > 0) {
      totalErrors.push(`Tasks edit failed with filter error:\n${filterErrors.join('\n')}`)
    }

    if (changeErrors.length > 0) {
      totalErrors.push(
        `Tasks edit failed with error in changes property:\n${changeErrors.join('\n')}`
      )
    }

    if (totalErrors.length > 0) {
      return {
        success: false,
        errorMsg: totalErrors.join('\n'),
        result: null,
      }
    }

    const editResult = await TaskAIController.editTasks(
      args.filter._ids,
      args.changes,
      timezone,
      user_id,
      thread_id
    )

    return {
      success: true,
      errorMsg: null,
      result: editResult,
    }
  },
  {
    name: 'editTasks',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕЙ задачи. Всегда требует ID задачи. Если ID неизвестен, сначала найди его с помощью findTasksByFilter или findRelevantTasks. Позволяет изменять имя задачи, описание, устанавливать дату, срок выполнения. Перемещать задачу между категориями. Изменять, перемещать задачи по порядку. Устанавливать или изменять цвет. Изменять, добавлять теги.',
    schema: editTasksSchema,
  }
)

const editCategories = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const filter = args.filter
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const totalErrors = []

    const filterErrors = await CategoryValidator.validate([args.filter], user_id, ['_ids'])

    const changeErrors = await CategoryValidator.validateChanges(args.changes, user_id)

    if (filterErrors.length > 0) {
      totalErrors.push(`Categories edit failed with filter error:\n${filterErrors.join('\n')}`)
    }

    if (changeErrors.length > 0) {
      totalErrors.push(
        `Categories edit failed with error in changes property:\n${changeErrors.join('\n')}`
      )
    }

    if (totalErrors.length > 0) {
      return {
        success: false,
        errorMsg: totalErrors.join('\n'),
        result: null,
      }
    }

    const editResult = await CategoryAIController.editCategories(
      filter._ids,
      args.changes,
      user_id,
      thread_id
    )

    return {
      success: true,
      errorMsg: null,
      result: editResult,
    }
  },
  {
    name: 'editCategories',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕЙ категории. Всегда требует ID категории. Если ID неизвестен, найди его с помощью findCategoriesByFilter или findRelevantCategories. Позволяет изменять название, перемещать между досками (изменяя board_id). Изменять, перемещать категории по порядку.',
    schema: editCategoriesSchema,
  }
)

const editBoards = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const filter = args.filter
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const totalErrors = []

    const filterErrors = await BoardValidator.validate([args.filter], user_id, ['_ids'])

    const changeErrors = await BoardValidator.validateChanges(args.changes, user_id)

    if (filterErrors.length > 0) {
      totalErrors.push(`Boards edit failed with filter error:\n${filterErrors.join('\n')}`)
    }

    if (changeErrors.length > 0) {
      totalErrors.push(
        `Boards edit failed with error in changes property:\n${changeErrors.join('\n')}`
      )
    }

    if (totalErrors.length > 0) {
      return {
        success: false,
        errorMsg: totalErrors.join('\n'),
        result: null,
      }
    }

    const editResult = await BoardAIController.editBoards(
      filter._ids,
      args.changes,
      user_id,
      thread_id
    )

    return {
      success: true,
      errorMsg: null,
      result: editResult,
    }
  },
  {
    name: 'editBoards',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕЙ доски. Всегда требует ID доски. Если ID неизвестен, найди его с помощью findBoardsByFilter или findRelevantBoards. Позволяет изменять название, перемещать между рабочими пространствами (изменяя workspace_id). Изменять, перемещать доски по порядку.',
    schema: editBoardsSchema,
  }
)

const editWorkspaces = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const filter = args.filter
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const totalErrors = []

    const filterErrors = await WorkspaceValidator.validate([args.filter], user_id, ['_ids'])

    const changeErrors = await WorkspaceValidator.validateChanges(args.changes)

    if (filterErrors.length > 0) {
      totalErrors.push(`Workspaces edit failed with filter error:\n${filterErrors.join('\n')}`)
    }

    if (changeErrors.length > 0) {
      totalErrors.push(
        `Workspaces edit failed with error in changes property:\n${changeErrors.join('\n')}`
      )
    }

    if (totalErrors.length > 0) {
      return {
        success: false,
        errorMsg: totalErrors.join('\n'),
        result: null,
      }
    }

    const editResult = await WorkspaceAIController.editWorkspaces(
      filter._ids,
      args.changes,
      user_id,
      thread_id
    )

    return {
      success: true,
      errorMsg: null,
      result: editResult,
    }
  },
  {
    name: 'editWorkspaces',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕГО пространства. Всегда требует ID пространства. Если ID неизвестен, найди его с помощью findWorkspacesByFilter или findRelevantWorkspaces. Позволяет изменять название, перемещать между досками (изменяя board_id). Изменять, перемещать пространства по порядку.',
    schema: editWorkspacesSchema,
  }
)
// =================================================================
// endregion

// region: 5. ARCHIVE
// =================================================================

const archiveWorkspaces = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await WorkspaceValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: errors.join('\n'),
        result: null,
      }
    }

    try {
      const result = await WorkspaceController.archiveWorkspacesHandler(_ids, user_id, thread_id)

      return {
        success: true,
        errorMsg: null,
        result,
      }
    } catch (e) {
      return {
        success: false,
        errorMsg: `Error archiving workspaces: ${
          (e as Error).message
        }. Try to fix or say to user about the error.`,
        result: null,
      }
    }
  },
  {
    name: 'archiveWorkspaces',
    description:
      'Применяй для архивации рабочих пространств, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID рабочего пространства. Если ID не дан, найди его с помощью findWorkspacesByFilter или findRelevantWorkspaces. Все ДОСКИ, КАТЕГОРИИ и ЗАДАЧИ внутри рабочего пространства также будут перемещены в архив',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID пространств для архивирования.'),
    }),
  }
)

const archiveBoards = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await BoardValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: errors.join('\n'),
        result: null,
      }
    }

    try {
      const result = await BoardController.archiveBoardsHandler(_ids, user_id, thread_id)
      return {
        success: true,
        errorMsg: null,
        result,
      }
    } catch (e) {
      return {
        success: false,
        errorMsg: `Error archiving workspaces: ${
          (e as Error).message
        }. Try to fix or say to user about the error.`,
        result: null,
      }
    }
  },
  {
    name: 'archiveBoards',
    description:
      'Применяй для архивации досок, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID доски. Если ID не дан, найди его с помощью findBoardsByFilter или findRelevantBoards. Все КАТЕГОРИИ и ЗАДАЧИ внутри доски также будут перемещены в архив',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID досок для архивирования.'),
    }),
  }
)

const archiveCategories = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await CategoryValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: errors.join('\n'),
        result: null,
      }
    }

    try {
      const result = await CategoryController.archiveCategoriesHandler(_ids, user_id, thread_id)
      return {
        success: true,
        errorMsg: null,
        result,
      }
    } catch (e) {
      return {
        success: false,
        errorMsg: `Error archiving workspaces: ${
          (e as Error).message
        }. Try to fix or say to user about the error.`,
        result: null,
      }
    }
  },
  {
    name: 'archiveCategories',
    description:
      'Применяй для архивации категорий, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID категории. Если ID не дан, найди его с помощью findCategoriesByFilter или findRelevantCategories. Все ЗАДАЧИ внутри категории также будут перемещены в архив.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID категорий для архивирования.'),
    }),
  }
)

const archiveTasks = tool(
  async (args, config: LangGraphRunnableConfig): Promise<IToolResult> => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await TaskValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return {
        success: false,
        errorMsg: errors.join('\n'),
        result: null,
      }
    }

    try {
      const result = await TaskController.archiveTasksHandler(_ids, user_id, thread_id)
      return {
        success: true,
        errorMsg: null,
        result,
      }
    } catch (e) {
      return {
        success: false,
        errorMsg: `Error archiving workspaces: ${
          (e as Error).message
        }. Try to fix or say to user about the error.`,
        result: null,
      }
    }
  },
  {
    name: 'archiveTasks',
    description:
      'Применяй для архивации задач, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID задачи. Если ID не дан, найди его с помощью findTasksByFilter или findRelevantTasks.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID задач для архивирования.'),
    }),
  }
)

// =================================================================
// endregion

// region: 6. RECOVER
// =================================================================

const recoverWorkspaces = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await WorkspaceValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await WorkspaceController.recoverWorkspacesHandler(_ids, user_id, thread_id)
    } catch (e) {
      return `Error recovering workspaces: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'recoverWorkspaces',
    description: 'Восстанавливает одно или несколько архивированных рабочих пространств по их ID.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID пространств для восстановления.'),
    }),
  }
)

const recoverBoards = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await BoardValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await BoardController.recoverBoardsHandler(_ids, user_id, thread_id)
    } catch (e) {
      return `Error recovering boards: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'recoverBoards',
    description: 'Восстанавливает одну или несколько архивированных досок по их ID.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID досок для восстановления.'),
    }),
  }
)

const recoverCategories = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await CategoryValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await CategoryController.recoverCategoriesHandler(_ids, user_id, thread_id)
    } catch (e) {
      return `Error recovering categories: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'recoverCategories',
    description: 'Восстанавливает одну или несколько архивированных категорий по их ID.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID категорий для восстановления.'),
    }),
  }
)

const recoverTasks = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id
    const thread_id = config.configurable?.thread_id

    const errors = await TaskValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await TaskController.recoverTasksHandler(_ids, user_id, thread_id)
    } catch (e) {
      return `Error recovering tasks: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'recoverTasks',
    description: 'Восстанавливает одну или несколько архивированных задач по их ID.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID задач для восстановления.'),
    }),
  }
)

// =================================================================
// endregion

// region: 7. DELETE
// =================================================================

const deleteWorkspaces = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id

    const errors = await WorkspaceValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await WorkspaceController.deleteWorkspacesHandler({ _id: { $in: _ids } }, user_id)
    } catch (e) {
      return `Error deleting workspaces: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'deleteWorkspaces',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления рабочих пространств. Всегда требует ID рабочего пространства. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID пространств для удаления.'),
    }),
  }
)

const deleteBoards = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id

    const errors = await BoardValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await BoardController.deleteBoardsHandler({ _id: { $in: _ids } }, user_id)
    } catch (e) {
      return `Error deleting boards: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'deleteBoards',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления досок. Всегда требует ID доски. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID досок для удаления.'),
    }),
  }
)

const deleteCategories = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id

    const errors = await CategoryValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await CategoryController.deleteCategoriesHandler({ _id: { $in: _ids } }, user_id)
    } catch (e) {
      return `Error deleting categories: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'deleteCategories',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления категорий. Всегда требует ID категории. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID категорий для удаления.'),
    }),
  }
)

const deleteTasks = tool(
  async (args, config: LangGraphRunnableConfig) => {
    const _ids = args._ids
    const user_id = config.configurable?.user_id

    const errors = await TaskValidator.validate([{ _ids }], user_id, ['_ids'])

    if (errors.length > 0) {
      return errors.join('\n')
    }

    try {
      return await TaskController.deleteTasksHandler({ _id: { $in: _ids } }, user_id)
    } catch (e) {
      return `Error deleting tasks: ${
        (e as Error).message
      }. Try to fix or say to user about the error.`
    }
  },
  {
    name: 'deleteTasks',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления задач. Всегда требует ID задачи. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
    schema: z.object({
      _ids: z.array(z.string()).describe('Массив ID задач для удаления.'),
    }),
  }
)

// =================================================================
// endregion

// region: 8. UNDO
// =================================================================
const undoOperations = tool(
  async (data, config: LangGraphRunnableConfig) => {
    /**
     * Revert operations by their IDs.
     */

    const operation_ids = data.operation_ids
    const userId = config.configurable?.user_id

    if (!Array.isArray(operation_ids) || operation_ids.length === 0) {
      return 'Invalid operation IDs.'
    }

    const result = await OperationLogController.undoOperationsHandler(operation_ids, userId)

    return JSON.stringify(result)
  },
  {
    name: 'undoOperations',
    description:
      'Критически важный инструмент. Используй, когда пользователь явно просит отменить действие. Например, отменить архивирование, отменить создание, редактирование, но не удаление',
    schema: z.object({
      operation_ids: z.array(z.string()).describe('IDs of the operations to undo'),
    }),
  }
)
// =================================================================
// endregion

// region: 9. CHAT
// =================================================================

const getChatHistory = tool(
  // Сама функция будет описана ниже
  async () => {
    return
  },
  {
    name: 'getChatHistory',
    description: `Внутренний инструмент для доступа к истории переписки. Используй его в начале, чтобы понять контекст запроса пользователя, особенно если он ссылается на предыдущие сообщения ('сделай то же самое для другой задачи').`,
    schema: GetChatHistorySchema,
  }
)

const getRelevantTools = tool(
  async () => {
    return
  },
  {
    name: 'getRelevantTools',
    description: `Внутренний инструмент для самоанализа. Используй его, чтобы расширить свой набор инструментов.`,
    schema: Plan,
  }
)

const finishResponse = tool(
  async () => {
    return
  },
  {
    name: 'finishResponse',
    description: `Внутренний инструмент для завершения работы. Используй его, чтобы сообщить о успехе, задать вопросы или сообщить об ошибках.`,
    schema: FinishResponseSchema,
  }
)
// =================================================================
// endregion

export {
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
}
