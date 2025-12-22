import { BASE_COLORS } from '@/constants/BASE_COLORS.ts'
import z from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

const zodName = z
  .string()
  .min(1, 'Name must be at least 1 character long')
  .max(100, 'Name must be at most 100 characters long')

const zodOrder = z.number().min(1, 'Order must be at least 1')
const zodTaskId = z.string().regex(objectIdRegex, 'Task ID must be a valid ObjectId string')
const zodCategoryId = z.string().regex(objectIdRegex, 'Category ID must be a valid ObjectId string')
const zodBoardId = z.string().regex(objectIdRegex, 'Board ID must be a valid ObjectId string')
const zodWorkspaceId = z
  .string()
  .regex(objectIdRegex, 'Workspace ID must be a valid ObjectId string')
const zodIsCompleted = z.boolean('Is Completed must be a boolean')
const zodIsArchived = z.boolean('Is Archived must be a boolean')

const zodTaskIds = z.array(zodTaskId, 'Each task ID must be a valid ObjectId string')
const zodCategoryIds = z.array(zodCategoryId, 'Each category ID must be a valid ObjectId string')
const zodBoardIds = z.array(zodBoardId, 'Each board ID must be a valid ObjectId string')
const zodWorkspaceIds = z.array(zodWorkspaceId, 'Each workspace ID must be a valid ObjectId string')
const zodTime = z.iso.time('should be a valid ISO 8601 time')
const zodDate = z.iso.datetime('should be a valid ISO 8601 datetime')
const zodNumber = z.union(
  [
    z.number(),
    z.string('Should be the valid numberic string').refine((val) => {
      try {
        if (typeof parseInt(val) === 'number' && !isNaN(parseInt(val))) return true
        else return false
      } catch {
        return false
      }
    }),
  ],
  'should be a number or numeric string'
)
const zodString = z.string('should be a string')
const zodArrayOfStrings = z.array(zodString, 'should be an array of strings')

const createTaskFieldsObject = {
  name: zodName,
  categoryId: zodCategoryId,
  description: z.string().max(400, 'Description must be at most 400 characters long').optional(),
  dueDate: z.iso.datetime('Due Date must be a valid ISO 8601 datetime string').optional(),
  color: z.string().optional().describe('HEX color code'),
  order: zodOrder.optional(),
  tags: z
    .array(z.union([z.string(), z.number()]), 'Tags must be an array of strings or numbers')
    .optional(),
  isCompleted: zodIsCompleted.optional(),
}
const TaskCreateSchema = z
  .object(
    {
      tasks: z.array(
        z
          .object(
            createTaskFieldsObject,
            'Available only task creation fields: ' + Object.keys(createTaskFieldsObject).join(', ')
          )
          .strict(),
        'Must be an array of tasks to create'
      ),
    },
    'Available only tasks field'
  )
  .strict()

type TaskCreateDTO = z.infer<typeof TaskCreateSchema>

const categoryFieldsObject = {
  name: zodName,
  boardId: zodBoardId,
  order: zodOrder.optional(),
}

const CategoryCreateSchema = z
  .object(
    {
      categories: z.array(
        z
          .object(
            categoryFieldsObject,
            'Available only category creation fields: ' +
              Object.keys(categoryFieldsObject).join(', ')
          )
          .strict(),
        'Must be an array of categories to create'
      ),
    },
    'Available only categories field'
  )
  .strict()

type CategoryCreateDTO = z.infer<typeof CategoryCreateSchema>

const boardFieldsObject = {
  name: zodName,
  workspaceId: zodWorkspaceId,
  order: zodOrder.optional(),
}
const BoardCreateSchema = z
  .object(
    {
      boards: z.array(
        z
          .object(
            boardFieldsObject,
            'Available only board creation fields: ' + Object.keys(boardFieldsObject).join(', ')
          )
          .strict(),
        'Must be an array of boards to create'
      ),
    },
    'Available only boards field'
  )
  .strict()

type BoardCreateDTO = z.infer<typeof BoardCreateSchema>

const workspaceFieldsObject = {
  name: zodName,
  color: z.enum(BASE_COLORS).describe('HEX color code'),
  order: zodOrder.optional(),
}
const WorkspaceCreateSchema = z
  .object(
    {
      workspaces: z.array(
        z
          .object(
            workspaceFieldsObject,
            'Available only workspace creation fields: ' +
              Object.keys(workspaceFieldsObject).join(', ')
          )
          .strict(),
        'Must be an array of workspaces to create'
      ),
    },
    'Available only workspaces field'
  )
  .strict()

type WorkspaceCreateDTO = z.infer<typeof WorkspaceCreateSchema>

const zodStringFilterObject = {
  equal: z.string('equal should be a string').optional(),
  not_equal: z.string('not_equal should be a string').optional(),
  contains: z.string('contains should be a string').optional(),
  starts_with: z.string('starts_with should be a string').optional(),
  ends_with: z.string('ends_with should be a string').optional(),
}

const StringFilter = z
  .object(
    zodStringFilterObject,
    'Available only string filter fields: ' + Object.keys(zodStringFilterObject).join(', ')
  )
  .strict()
  .describe('A filter for text-based fields.')

const zodDateTimeFilterObject = {
  equal: zodString.optional(),
  greater_than: zodString.optional(),
  greater_than_equal: zodString.optional(),
  less_than: zodString.optional(),
  less_than_equal: zodString.optional(),
}

const DateTimeFilter = z
  .object(
    zodDateTimeFilterObject,
    'Available only date-time filter fields: ' + Object.keys(zodDateTimeFilterObject).join(', ')
  )
  .strict()
  .describe('A filter for date and time fields. Requires ISO 8601 format.')

const zodNumberFilterObject = {
  equal: zodNumber.optional(),
  not_equal: zodNumber.optional(),
  greater_than: zodNumber.optional(),
  greater_than_equal: zodNumber.optional(),
  less_than: zodNumber.optional(),
  less_than_equal: zodNumber.optional(),
}

const NumberFilter = z
  .object(
    zodNumberFilterObject,
    'Available only number filter fields: ' + Object.keys(zodNumberFilterObject).join(', ')
  )
  .strict()
  .describe('A filter for numeric fields.')

const zodStringFilter = {
  contains: zodArrayOfStrings.optional(),
  contains_all: zodArrayOfStrings.optional(),
  equals: zodArrayOfStrings.optional(),
}

const ArrayFilter = z
  .object(
    zodStringFilter,
    'Available only array filter fields: ' + Object.keys(zodStringFilter).join(', ')
  )
  .strict()
  .describe('A filter for arrays, such as tags.')

const taskFilterObject = {
  ids: zodTaskIds
    .optional()
    .describe(
      'A definitive list of task IDs to find. If this is provided, all other filter fields MUST be ignored.'
    ),

  categoryIds: zodCategoryIds.optional(),
  boardIds: zodBoardIds.optional(),
  workspaceIds: zodWorkspaceIds.optional(),
  isCompleted: zodIsCompleted.optional(),
  isArchived: zodIsArchived.optional().describe('SET TO TRUE ONLY WHEN FINDING TASKS FOR RECOVERY'),

  name: StringFilter.optional(),
  description: StringFilter.optional(),

  dueDate: DateTimeFilter.optional().describe('Filter by due date using ISO 8601 format.'),
  dueTime: DateTimeFilter.optional(),
  tags: ArrayFilter.optional(),

  color: StringFilter.optional().describe(
    "Filter by color using a standard 6-digit HEX format. The value MUST start with a '#'. Examples: '#FF5733' for orange, '#FFFFFF' for white, '#0000FF' for blue. Natural language color names like 'blue' are INVALID and will be rejected."
  ),
  order: NumberFilter.optional(),
}

const TaskFilterSchema = z
  .object(
    taskFilterObject,
    'Available only task filter fields: ' + Object.keys(taskFilterObject).join(', ')
  )
  .strict()

const ConditionalTaskFilterSchema = TaskFilterSchema.extend({
  AND: z
    .lazy((): any =>
      z.array(
        ConditionalTaskFilterSchema,
        'should be an array of task filters: ' +
          Object.keys(ConditionalTaskFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe('An array of filters. All conditions in this array must be met (logical AND).'),
  OR: z
    .lazy((): any =>
      z.array(
        ConditionalTaskFilterSchema,
        'should be an array of task filters: ' +
          Object.keys(ConditionalTaskFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe(
      'An array of filters. At least one condition in this array must be met (logical OR).'
    ),
})

type ConditionalTaskFilterDTO = z.infer<typeof ConditionalTaskFilterSchema>

const categoryFilterObject = {
  ids: zodCategoryIds
    .optional()
    .describe(
      'A definitive list of task IDs to find. If this is provided, all other filter fields MUST be ignored.'
    ),

  boardIds: zodBoardIds.optional(),
  workspaceIds: zodWorkspaceIds.optional(),
  isArchived: zodIsArchived
    .optional()
    .describe('SET TO TRUE ONLY WHEN FINDING CATEGORIES FOR RECOVERY'),

  name: StringFilter.optional(),
  order: NumberFilter.optional(),
}

const CategoryFilterSchema = z
  .object(
    categoryFilterObject,
    'Available only category filter fields: ' + Object.keys(categoryFilterObject).join(', ')
  )
  .strict()

const ConditionalCategoryFilterSchema = CategoryFilterSchema.extend({
  AND: z
    .lazy((): any =>
      z.array(
        ConditionalCategoryFilterSchema,
        'should be an array of category filters: ' +
          Object.keys(ConditionalCategoryFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe('An array of filters. All conditions in this array must be met (logical AND).'),
  OR: z
    .lazy((): any =>
      z.array(
        ConditionalCategoryFilterSchema,
        'should be an array of category filters: ' +
          Object.keys(ConditionalCategoryFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe(
      'An array of filters. At least one condition in this array must be met (logical OR).'
    ),
})

type ConditionalCategoryFilterDTO = z.infer<typeof ConditionalCategoryFilterSchema>

const boardFilterObject = {
  ids: zodBoardIds
    .optional()
    .describe(
      'A definitive list of task IDs to find. If this is provided, all other filter fields MUST be ignored.'
    ),

  workspaceIds: zodWorkspaceIds.optional(),
  isArchived: zodIsArchived
    .optional()
    .describe('SET TO TRUE ONLY WHEN FINDING BOARDS FOR RECOVERY'),

  name: StringFilter.optional(),
  order: NumberFilter.optional(),
}

const BoardFilterSchema = z
  .object(
    boardFilterObject,
    'Available only board filter fields: ' + Object.keys(boardFilterObject).join(', ')
  )
  .strict()

const ConditionalBoardFilterSchema = BoardFilterSchema.extend({
  AND: z
    .lazy((): any =>
      z.array(
        ConditionalBoardFilterSchema,
        'should be an array of board filters: ' +
          Object.keys(ConditionalBoardFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe('An array of filters. All conditions in this array must be met (logical AND).'),
  OR: z
    .lazy((): any =>
      z.array(
        ConditionalBoardFilterSchema,
        'should be an array of board filters: ' +
          Object.keys(ConditionalBoardFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe(
      'An array of filters. At least one condition in this array must be met (logical OR).'
    ),
})

type ConditionalBoardFilterDTO = z.infer<typeof ConditionalBoardFilterSchema>

const workspaceFilterObject = {
  ids: zodWorkspaceIds
    .optional()
    .describe(
      'A definitive list of task IDs to find. If this is provided, all other filter fields MUST be ignored.'
    ),

  isArchived: zodIsArchived
    .optional()
    .describe('SET TO TRUE ONLY WHEN FINDING WORKSPACES FOR RECOVERY'),
  name: StringFilter.optional(),
  order: NumberFilter.optional(),
}
const WorkspaceFilterSchema = z
  .object(
    workspaceFilterObject,
    'Available only workspace filter fields: ' + Object.keys(workspaceFilterObject).join(', ')
  )
  .strict()

const ConditionalWorkspaceFilterSchema = WorkspaceFilterSchema.extend({
  AND: z
    .lazy((): any =>
      z.array(
        ConditionalWorkspaceFilterSchema,
        'should be an array of workspace filters: ' +
          Object.keys(ConditionalWorkspaceFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe('An array of filters. All conditions in this array must be met (logical AND).'),
  OR: z
    .lazy((): any =>
      z.array(
        ConditionalWorkspaceFilterSchema,
        'should be an array of workspace filters: ' +
          Object.keys(ConditionalWorkspaceFilterSchema.shape).join(', ')
      )
    )
    .optional()
    .describe(
      'An array of filters. At least one condition in this array must be met (logical OR).'
    ),
})

type ConditionalWorkspaceFilterDTO = z.infer<typeof ConditionalWorkspaceFilterSchema>

const stringModificationObject = {
  set: zodString.optional().describe('Полностью заменить значение поля.'),
  append: zodString.optional().describe('Добавить текст в конец текущего значения.'),
  prepend: zodString.optional().describe('Добавить текст в начало текущего значения.'),
  replace_part: z
    .object(
      {
        find: zodString,
        replace_with: zodString,
      },
      'should be an object with find and replace_with strings'
    )
    .optional()
    .describe('Найти и заменить часть строки.'),
}
const StringModificationSchema = z
  .object(
    stringModificationObject,
    'Available only string modification fields: ' + Object.keys(stringModificationObject).join(', ')
  )
  .strict()

// Блок для операций над полем даты (dueDate)
const dateModificationObject = {
  set: zodDate
    .optional()
    .describe("Установить точную дату и время (ISO 8601). Например '2024-10-26T10:00:00Z'."),
  shift_duration: zodString
    .optional()
    .describe(
      "Сдвинуть дату/время. Формат ISO 8601 Duration, например 'P2D' (вперед на 2 дня), '-PT1H30M' (назад на 1 час 30 минут)."
    ),
}
const DateModificationSchema = z
  .object(
    dateModificationObject,
    'Available only date modification fields: ' + Object.keys(dateModificationObject).join(', ')
  )
  .strict()

// Блок для операций над полем даты (dueDate)
const timeModificationObject = {
  set: zodTime.optional().describe("Установить точное время. Например '10:00'."),
}
const TimeModificationSchema = z
  .object(
    timeModificationObject,
    'Available only time modification fields: ' + Object.keys(timeModificationObject).join(', ')
  )
  .strict()

// Блок для операций над массивом тегов (tags)
const tagsModificationObject = {
  set: zodArrayOfStrings.optional().describe('Полностью заменить список тегов на новый.'),
  add: z
    .array(zodString)
    .optional()
    .describe('Добавить теги в список (дубликаты будут проигнорированы).'),
  remove: z.array(zodString).optional().describe('Удалить теги из списка.'),
}
const TagsModificationSchema = z
  .object(
    tagsModificationObject,
    'Available only tags modification fields: ' + Object.keys(tagsModificationObject).join(', ')
  )
  .strict()

const editTasksChangesObject = {
  /**
   * Операции для изменения названия задачи.
   */
  name: StringModificationSchema.optional(),

  /**
   * Операции для изменения описания задачи.
   */
  description: StringModificationSchema.nullable().optional(),

  /**
   * Операции для изменения даты выполнения.
   */
  dueDate: DateModificationSchema.nullable().optional().describe('Must be in ISO 8601 format.'),
  dueTime: TimeModificationSchema.nullable().optional().describe('Must be in HH:mm format.'),

  /**
   * Операции для изменения тегов.
   */
  tags: TagsModificationSchema.nullable().optional(),

  /**
   * Установить новый ID категории.
   */
  categoryId: zodCategoryId.optional(),

  /**
   * Установить статус выполнения задачи.
   */
  isCompleted: zodIsCompleted.optional().describe('isCompleted must be always true or false.'),

  /**
   * Установить статус архивации задачи.
   */
  isArchived: zodIsArchived.optional().describe('isArchived must be always true or false.'),

  /**
   * Установить цвет в формате HEX, например '#FF5733'.
   * Цвет будет автоматически приведен к ближайшему из стандартной палитры.
   */
  color: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Set a new color using a HEX value (e.g., '#FF5733'). To remove the color, pass null."
    ),

  /**
   * Установить или удалить порядковый номер.
   */
  order: zodNumber.optional().describe('Установить новый порядковый номер.'),
}

const editTasksObject = {
  filter: z
    .object(
      {
        ids: zodTaskIds.describe('Массив ID задач для фильтрации.'),
      },
      'Available only task filter fields: ids'
    )
    .strict()
    .describe('Фильтр для выбора задач, которые нужно изменить.'),

  changes: z
    .object(
      editTasksChangesObject,
      'Available only task changes fields: ' + Object.keys(editTasksChangesObject).join(', ')
    )
    .strict()
    .describe('Объект с изменениями, которые нужно применить к найденным задачам.'),
}
const EditTasksSchema = z
  .object(
    editTasksObject,
    'Available only task modification fields: ' + Object.keys(editTasksObject).join(', ')
  )
  .strict()

type EditTasksDTO = z.infer<typeof EditTasksSchema>

const editCategoriesChangesObject = {
  /**
   * Операции для изменения названия категории.
   */
  name: StringModificationSchema.optional(),

  /**
   * Установить новый ID категории.
   */
  boardId: zodBoardId.optional(),

  /**
   * Установить или удалить порядковый номер.
   */
  order: zodNumber.optional().describe('Установить новый порядковый номер.'),
}
const editCategoriesObject = {
  filter: z
    .object(
      {
        ids: zodCategoryIds.describe('Массив ID категорий для фильтрации.'),
      },
      'Available only category filter fields: ids'
    )
    .strict()
    .describe('Фильтр для выбора категорий, которые нужно изменить.'),

  changes: z
    .object(
      editCategoriesChangesObject,
      'Available only category changes fields: ' +
        Object.keys(editCategoriesChangesObject).join(', ')
    )
    .strict()
    .describe('Объект с изменениями, которые нужно применить к найденным категориям.'),
}
const EditCategoriesSchema = z
  .object(
    editCategoriesObject,
    'Available only category modification fields: ' + Object.keys(editCategoriesObject).join(', ')
  )
  .strict()

type EditCategoriesDTO = z.infer<typeof EditCategoriesSchema>

const editBoardsChangesObject = {
  /**
   * Операции для изменения названия доски.
   */
  name: StringModificationSchema.optional(),

  /**
   * Установить новый ID категории.
   */
  workspaceId: zodWorkspaceId.optional(),

  /**
   * Установить или удалить порядковый номер.
   */
  order: zodNumber.optional().describe('Установить новый порядковый номер.'),
}
const editBoardsObject = {
  filter: z
    .object(
      {
        ids: zodBoardIds.describe('Массив ID досок для фильтрации.'),
      },
      'Available only board filter fields: ids'
    )
    .strict()
    .describe('Фильтр для выбора досок, которые нужно изменить.'),

  changes: z
    .object(
      editBoardsChangesObject,
      'Available only board changes fields: ' + Object.keys(editBoardsChangesObject).join(', ')
    )
    .strict()
    .describe('Объект с изменениями, которые нужно применить к найденным доскам.'),
}
const EditBoardsSchema = z
  .object(
    editBoardsObject,
    'Available only board modification fields: ' + Object.keys(editBoardsObject).join(', ')
  )
  .strict()

type EditBoardsDTO = z.infer<typeof EditBoardsSchema>

const editWorkspacesChangesObject = {
  /**
   * Операции для изменения названия доски.
   */
  name: StringModificationSchema.optional(),

  /**
   * Установить или удалить порядковый номер.
   */
  order: zodNumber.optional().describe('Установить новый порядковый номер.'),
}
const editWorkspacesObject = {
  filter: z
    .object({
      ids: zodWorkspaceIds.describe('Массив ID пространств для фильтрации.'),
    })
    .describe('Фильтр для выбора пространств, которые нужно изменить.'),

  changes: z
    .object(
      editWorkspacesChangesObject,
      'Available only workspace changes fields: ' +
        Object.keys(editWorkspacesChangesObject).join(', ')
    )
    .strict()
    .describe('Объект с изменениями, которые нужно применить к найденным пространствам.'),
}

const EditWorkspacesSchema = z
  .object(
    editWorkspacesObject,
    'Available only workspace changes fields: ' + Object.keys(editWorkspacesObject).join(', ')
  )
  .strict()

type EditWorkspacesDTO = z.infer<typeof EditWorkspacesSchema>

const GetChatHistorySchema = z.object({
  return_summary: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Set to true to receive a concise summary of the history instead of the full transcript. This is MUCH faster and cheaper for getting general context. Use this by default unless you need specific, verbatim details.'
    ),

  turns: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Fetches the last N conversation turns. A 'turn' includes one user message and one assistant response. Ideal for understanding recent context."
    ),

  all: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Fetches the entire conversation history. Use this as a last resort if you need to find something from the very beginning and a summary is not enough.'
    ),

  message_number: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Fetches a single, specific message by its absolute number in the conversation (e.g., 3 for the third message).'
    ),

  message_range: z
    .object({
      start: z.number().int().positive(),
      end: z.number().int().positive(),
    })
    .optional()
    .describe('Fetches a specific range of messages, e.g., from message 5 to 10.'),
})

const Step = z.object({
  description: z
    .string()
    .describe(
      "Описание одного атомарного действия, которое может быть выполнено одним инструментом. Разбивайте сложные запросы на несколько последовательных коротких шагов. Не объединяйте действия, такие как 'найти задачи для их удаления'. Например, 'удалить соответствующие задачи' должно быть двумя шагами: 'найти соответствующие задачи', а затем 'удалить найденные задачи'."
    ),
})

const Plan = z.object({
  steps: z
    .array(Step)
    .describe(
      "Массив логических шагов для выполнения запроса пользователя. Шаги должны быть максимально короткими и описательными. Например, 'найти задачу', 'создать категорию', 'изменить задачу' и т.д."
    ),
})

const FinishStatusSchema = z.enum(['SUCCESS', 'AWAITING_USER_INPUT', 'ERROR'])
const FinishResponseSchema = z.object({
  status: FinishStatusSchema.describe(
    "The final status of the operation. Use 'SUCCESS' for completed tasks, 'AWAITING_USER_INPUT' when you need to ask the user a question, and 'ERROR' for failures."
  ),

  summary: z
    .string()
    .describe(
      "A concise, factual, machine-readable summary of the outcome in English. This is the primary instruction for the response synthesizer. Examples: 'Task 'Buy Milk' created.', 'Ask user to clarify which category to use.', 'Failed to find the specified task.'"
    ),

  output_data: z
    .array(z.record(z.string(), z.any()))
    .optional()
    .describe(
      'A list of data objects (e.g., created or found tasks/categories) to be presented to the user. All internal IDs MUST be redacted from these objects before passing them here.'
    ),

  error_details: z
    .string()
    .optional()
    .describe(
      "If the status is 'ERROR', provide a simple, non-technical explanation of the problem here. This will be used to formulate the final error message to the user."
    ),
})

export {
  ConditionalTaskFilterSchema,
  ConditionalTaskFilterDTO,
  ConditionalCategoryFilterSchema,
  ConditionalCategoryFilterDTO,
  ConditionalBoardFilterSchema,
  ConditionalBoardFilterDTO,
  ConditionalWorkspaceFilterSchema,
  ConditionalWorkspaceFilterDTO,
  TaskCreateSchema,
  TaskCreateDTO,
  CategoryCreateSchema,
  CategoryCreateDTO,
  BoardCreateSchema,
  BoardCreateDTO,
  WorkspaceCreateSchema,
  WorkspaceCreateDTO,
  EditTasksSchema,
  EditTasksDTO,
  EditCategoriesSchema,
  EditCategoriesDTO,
  EditBoardsSchema,
  EditBoardsDTO,
  EditWorkspacesSchema,
  EditWorkspacesDTO,
  GetChatHistorySchema,
  Plan,
  Step,
  FinishResponseSchema,
}
