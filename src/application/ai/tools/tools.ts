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
  GetChatHistorySchema,
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
      description:
        'Используй этот инструмент, чтобы найти одну или несколько категорий по ее названию или другим атрибутам. Это необходимый шаг перед созданием задачи в конкретной категории или перед перемещением задачи в нее. Указывай ТОЛЬКО необходимые фильтры.',
      schema: CategoryFilterSchema,
    }
  )

  const findRelevantCategories = tool(
    ({ nameToFind }, config) => adapter.findRelevantCategories({ nameToFind }, config),
    {
      name: 'findRelevantCategories',
      description:
        "Применяй, когда пользователь просит найти 'похожие категории', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findCategoriesByFilter, который ищет по точным критериям.",
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createCategories = tool((data, config) => adapter.createCategories(data, config), {
    name: 'createCategories',
    description:
      'Применяй для создания новых категорий (колонок) на доске. Всегда требует название категории и board_id. Если board_id неизвестен, используй текущий активный ID или найди его с помощью findBoardsByFilter.',
    schema: CategoryCreateSchema,
  })

  const editCategories = tool((args, config) => adapter.editCategories(args, config), {
    name: 'editCategories',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕЙ категории. Всегда требует ID категории. Если ID неизвестен, найди его с помощью findCategoriesByFilter или findRelevantCategories. Позволяет изменять название, перемещать между досками (изменяя board_id). Изменять, перемещать категории по порядку.',
    schema: EditCategoriesSchema,
  })

  const archiveCategories = tool((args, config) => adapter.archiveCategories(args, config), {
    name: 'archiveCategories',
    description:
      'Применяй для архивации категорий, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID категории. Если ID не дан, найди его с помощью findCategoriesByFilter или findRelevantCategories. Все ЗАДАЧИ внутри категории также будут перемещены в архив.',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID категорий для архивирования.'),
    }),
  })

  const recoverCategories = tool((args, config) => adapter.recoverCategories(args, config), {
    name: 'recoverCategories',
    description: 'Восстанавливает одну или несколько архивированных категорий по их ID.',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID категорий для восстановления.'),
    }),
  })

  const deleteCategories = tool((args, config) => adapter.deleteCategories(args, config), {
    name: 'deleteCategories',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления категорий. Всегда требует ID категории. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
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
    description:
      'Используй, чтобы найти одну или несколько досок по её названию, порядку, архивированию, пространству. Это нужно, чтобы создавать в ней категории, перемещать в нее задачи или изменять саму доску. Обязательный шаг, если ID доски не предоставлен явно. Указывай ТОЛЬКО необходимые фильтры.',
    schema: BoardFilterSchema,
  })

  const findRelevantBoards = tool(
    ({ nameToFind }, config) => adapter.findRelevantBoards({ nameToFind }, config),
    {
      name: 'findRelevantBoards',
      description:
        "Применяй, когда пользователь просит найти 'похожие доски', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findBoardsByFilter, который ищет по точным критериям.",
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createBoards = tool((data, config) => adapter.createBoards(data, config), {
    name: 'createBoards',
    description:
      'Применяй для создания новых досок. Всегда требует название доски и workspace_id. Если workspace_id неизвестен, используй текущий активный ID или найди его с помощью findWorkspacesByFilter.',
    schema: BoardCreateSchema,
  })

  const editBoards = tool((args, config) => adapter.editBoards(args, config), {
    name: 'editBoards',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕЙ доски. Всегда требует ID доски. Если ID неизвестен, найди его с помощью findBoardsByFilter или findRelevantBoards. Позволяет изменять название, перемещать между рабочими пространствами (изменяя workspace_id). Изменять, перемещать доски по порядку.',
    schema: EditBoardsSchema,
  })

  const archiveBoards = tool((args, config) => adapter.archiveBoards(args, config), {
    name: 'archiveBoards',
    description:
      'Применяй для архивации досок, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID доски. Если ID не дан, найди его с помощью findBoardsByFilter или findRelevantBoards. Все КАТЕГОРИИ и ЗАДАЧИ внутри доски также будут перемещены в архив',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID досок для архивирования.'),
    }),
  })

  const recoverBoards = tool((args, config) => adapter.recoverBoards(args, config), {
    name: 'recoverBoards',
    description: 'Восстанавливает одну или несколько архивированных досок по их ID.',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID досок для восстановления.'),
    }),
  })

  const deleteBoards = tool((args, config) => adapter.deleteBoards(args, config), {
    name: 'deleteBoards',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления досок. Всегда требует ID доски. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
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
      description:
        'Используй, чтобы найти одно или несколько рабочих пространств по его названию, порядку или архивированию. Это необходимо для создания в нем досок или для его изменения, если ID не известен. Указывай ТОЛЬКО необходимые фильтры.',
      schema: WorkspaceFilterSchema,
    }
  )

  const findRelevantWorkspaces = tool(
    ({ nameToFind }, config) => adapter.findRelevantWorkspaces({ nameToFind }, config),
    {
      name: 'findRelevantWorkspaces',
      description:
        "Применяй, когда пользователь просит найти 'похожие рабочие пространства', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findWorkspacesByFilter, который ищет по точным критериям.",
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createWorkspaces = tool((data, config) => adapter.createWorkspaces(data, config), {
    name: 'createWorkspaces',
    description:
      'Применяй для создания новых рабочих пространств. Всегда требует название рабочего пространства.',
    schema: WorkspaceCreateSchema,
  })

  const editWorkspaces = tool((args, config) => adapter.editWorkspaces(args, config), {
    name: 'editWorkspaces',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕГО пространства. Всегда требует ID пространства. Если ID неизвестен, найди его с помощью findWorkspacesByFilter или findRelevantWorkspaces. Позволяет изменять название, перемещать между досками (изменяя board_id). Изменять, перемещать пространства по порядку.',
    schema: EditWorkspacesSchema,
  })

  const archiveWorkspaces = tool((args, config) => adapter.archiveWorkspaces(args, config), {
    name: 'archiveWorkspaces',
    description:
      'Применяй для архивации рабочих пространств, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID рабочего пространства. Если ID не дан, найди его с помощью findWorkspacesByFilter или findRelevantWorkspaces. Все ДОСКИ, КАТЕГОРИИ и ЗАДАЧИ внутри рабочего пространства также будут перемещены в архив',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID пространств для архивирования.'),
    }),
  })

  const recoverWorkspaces = tool((args, config) => adapter.recoverWorkspaces(args, config), {
    name: 'recoverWorkspaces',
    description: 'Восстанавливает одно или несколько архивированных рабочих пространств по их ID.',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID пространств для восстановления.'),
    }),
  })

  const deleteWorkspaces = tool((args, config) => adapter.deleteWorkspaces(args, config), {
    name: 'deleteWorkspaces',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления рабочих пространств. Всегда требует ID рабочего пространства. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
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
    description:
      "Используй, чтобы найти одну или несколько задач по их свойствам (названию, статусу, дате). Это необходимо, чтобы затем изменить, архивировать, удалить или просто проверить информацию о задаче. Применяй, когда пользователь говорит 'найди задачу...' или 'что со статусом задачи...'. Указывай ТОЛЬКО необходимые фильтры.",
    schema: TaskFilterSchema,
  })

  const findRelevantTasks = tool(
    ({ nameToFind }, config) => adapter.findRelevantTasks({ nameToFind }, config),
    {
      name: 'findRelevantTasks',
      description:
        "Применяй, когда пользователь просит найти 'похожие задачи', 'связанные с этим' или ищет что-то, не помня точного названия. Этот инструмент хорош для семантического поиска и подсказок, в отличие от findTasksByFilter, который ищет по точным критериям.",
      schema: z.object({
        nameToFind: z.string(),
      }),
    }
  )

  const createTasks = tool((data, config) => adapter.createTasks(data, config), {
    name: 'createTasks',
    description:
      'Основной инструмент для создания одной или нескольких новых задач. Всегда требует название задачи. Для создания задачи в определенной категории, сначала используй findCategoriesByFilter, чтобы получить category_id.',
    schema: TaskCreateSchema,
  })

  const editTasks = tool((args, config) => adapter.editTasks(args, config), {
    name: 'editTasks',
    description:
      'Используй для изменения СУЩЕСТВУЮЩЕЙ задачи. Всегда требует ID задачи. Если ID неизвестен, сначала найди его с помощью findTasksByFilter или findRelevantTasks. Позволяет изменять имя задачи, описание, устанавливать дату, срок выполнения. Перемещать задачу между категориями. Изменять, перемещать задачи по порядку. Устанавливать или изменять цвет. Изменять, добавлять теги.',
    schema: EditTasksSchema,
  })

  const archiveTasks = tool((args, config) => adapter.archiveTasks(args, config), {
    name: 'archiveTasks',
    description:
      'Применяй для архивации задач, которые не актуальны, но могут понадобиться в будущем. Это обратимое действие. Всегда требует ID задачи. Если ID не дан, найди его с помощью findTasksByFilter или findRelevantTasks.',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID задач для архивирования.'),
    }),
  })

  const recoverTasks = tool((args, config) => adapter.recoverTasks(args, config), {
    name: 'recoverTasks',
    description: 'Восстанавливает одну или несколько архивированных задач по их ID.',
    schema: z.object({
      ids: z.array(z.string()).describe('Массив ID задач для восстановления.'),
    }),
  })

  const deleteTasks = tool((args, config) => adapter.deleteTasks(args, config), {
    name: 'deleteTasks',
    description:
      'Используй для БЕЗВОЗВРАТНОГО удаления задач. Всегда требует ID задачи. Это действие необратимо, в отличие от архивации. Будь осторожен при его использовании.',
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
    async (data, config) => {
      await adapter.showEntitiesToUser(data, config)

      return 'Entities have been presented to the user.'
    },
    {
      name: 'showEntitiesToUser',
      description: 'Показывает пользователю сущности по их ID и типу.',
      schema: ShowEntitiesToUserSchema,
    }
  )

  const undoOperations = tool(async (data, config) => adapter.undoOperations(data, config), {
    name: 'undoOperations',
    description:
      'Критически важный инструмент. Используй, когда пользователь явно просит отменить действие. Например, отменить архивирование, отменить создание, редактирование, но не удаление',
    schema: z.object({
      operationIds: z.array(z.string()).describe('IDs of the operations to undo'),
    }),
  })

  const getChatHistory = tool(
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

  return [
    showEntitiesToUser,
    undoOperations,
    getChatHistory,
    getRelevantTools,
    finishResponse,
    submitPlan,
  ]
}
