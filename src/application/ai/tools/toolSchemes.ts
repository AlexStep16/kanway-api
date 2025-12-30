import { BASE_COLORS } from '@/constants/BASE_COLORS.ts'
import dayjs from 'dayjs'
import z from 'zod'

const zodName = z
  .string()
  .min(1, 'Name must be at least 1 character long')
  .max(100, 'Name must be at most 100 characters long')
const zodDescription = z.string().max(300, 'Description must be at most 300 characters long')
const zodColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a HEX code (e.g., #A1B2C3)')
  .describe('HEX color code')
const zodWorkspaceColor = z
  .enum(BASE_COLORS, 'Color must be one of the predefined base colors: ' + BASE_COLORS.join(', '))
  .default(BASE_COLORS[3])
  .describe('HEX color code')
const zodOrder = z.coerce.number().describe('Order must be a number representing the position.')
const zodTags = z.array(z.string())
const zodIsNegated = z
  .boolean()
  .default(false)
  .describe('Set to true for "EXCEPT" or "NOT" conditions.')

const zodDueDate = z
  .string()
  .refine((val) => {
    return dayjs(val, 'YYYY-MM-DD', true).isValid()
  })
  .describe('Date in YYYY-MM-DD format.')

const zodDueTime = z
  .string()
  .refine((val) => {
    return dayjs(val, 'HH:mm', true).isValid()
  })
  .describe('Time in HH:mm format.')

const zodObjectId = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: 'Invalid ObjectId format',
  })
  .describe('The unique 24-char hex ID')

const zodConditionalValueRefinement = z.array(z.literal('Current schema')).refine((val) => {
  if (typeof val !== 'object' || val === null) return false

  const allowedKeys = Object.keys(taskFilterObject)

  for (const key of Object.keys(val)) {
    if (!allowedKeys.includes(key)) {
      return false
    }
  }

  return true
})

const andSchema = zodConditionalValueRefinement.describe(
  'Use for logical AND conditions. An array of conditions to be ANDed together.'
)
const orSchema = zodConditionalValueRefinement.describe(
  'Use for logical OR conditions. An array of conditions to be ORed together.'
)

const createTaskFieldsObject = {
  name: zodName.describe('Task name. Should be clear and concise.'),
  categoryId: zodObjectId,
  description: zodDescription.optional(),
  dueDate: zodDueDate.optional(),
  dueTime: zodDueTime.optional(),
  color: zodColor.optional(),
  order: zodOrder.optional(),
  tags: zodTags.optional(),
  isCompleted: z.boolean().optional(),
}
const TaskCreateSchema = z
  .object(
    {
      tasks: z.array(
        z.object(
          createTaskFieldsObject,
          'Available only task creation fields: ' + Object.keys(createTaskFieldsObject).join(', ')
        ),
        'Must be an array of tasks to create'
      ),
    },
    'Available only tasks field'
  )
  .strict()
  .describe(
    'If the user does not provide category then create the category with default category name but first try semantic search for some categories.'
  )

type TaskCreateDTO = z.infer<typeof TaskCreateSchema>

const categoryFieldsObject = {
  name: zodName.describe('Category name. Should be clear and concise.'),
  boardId: zodObjectId,
  order: zodOrder.optional(),
}

const CategoryCreateSchema = z
  .object(
    {
      categories: z.array(
        z.object(
          categoryFieldsObject,
          'Available only category creation fields: ' + Object.keys(categoryFieldsObject).join(', ')
        ),
        'Must be an array of categories to create'
      ),
    },
    'Available only categories field'
  )
  .strict()
  .describe(
    'If the user does not provide board then create the board with default board name but first try semantic search for some boards.'
  )

type CategoryCreateDTO = z.infer<typeof CategoryCreateSchema>

const boardFieldsObject = {
  name: zodName.describe('Board name. Should be clear and concise.'),
  workspaceId: zodObjectId,
  isFavorite: z.boolean().default(false),
  order: zodOrder.optional(),
}
const BoardCreateSchema = z
  .object(
    {
      boards: z.array(
        z.object(
          boardFieldsObject,
          'Available only board creation fields: ' + Object.keys(boardFieldsObject).join(', ')
        ),
        'Must be an array of boards to create'
      ),
    },
    'Available only boards field'
  )
  .strict()

type BoardCreateDTO = z.infer<typeof BoardCreateSchema>

const workspaceFieldsObject = {
  name: zodName.describe('Workspace name. Should be clear and concise.'),
  isFavorite: z.boolean().default(false),
  color: zodWorkspaceColor,
  order: zodOrder.optional(),
}
const WorkspaceCreateSchema = z
  .object(
    {
      workspaces: z.array(
        z.object(
          workspaceFieldsObject,
          'Available only workspace creation fields: ' +
            Object.keys(workspaceFieldsObject).join(', ')
        ),
        'Must be an array of workspaces to create'
      ),
    },
    'Available only workspaces field'
  )
  .strict()

type WorkspaceCreateDTO = z.infer<typeof WorkspaceCreateSchema>

const StringFilter = z
  .object(
    {
      value: z.coerce
        .string()
        .min(1, 'Value must be at least 1 character long')
        .describe('The text to search for (e.g., "urgent", "report").'),

      operator: z
        .enum(
          ['equal', 'contains', 'starts_with', 'ends_with'],
          'Operator must be one of: equal, contains, starts_with, ends_with'
        )
        .describe('Comparison logic. Use "contains" for partial matches, "equal" for exact match'),

      isNegated: zodIsNegated,
    },
    'Available only string filter fields: value, operator, isNegated'
  )
  .strict()

const BaseNumberFilter = z
  .object(
    {
      operator: z.enum(
        ['eq', 'gt', 'gte', 'lt', 'lte'],
        'Operator must be one of: eq, gt, gte, lt, lte'
      ),
      isNegated: zodIsNegated,
    },
    'Available only base number filter fields: operator, isNegated'
  )
  .strict()

const DateFilter = BaseNumberFilter.extend({
  value: zodDueDate,
})

const TimeFilter = BaseNumberFilter.extend({
  value: zodDueTime,
})

const NumberFilter = BaseNumberFilter.extend({
  value: z.coerce.number().describe('The number to compare against.'),
})

const BaseArrayFilter = z
  .object(
    {
      operator: z
        .enum(
          ['equal', 'contains_all', 'contains_any'],
          'Operator must be one of: equal, contains_all, contains_any'
        )
        .describe('contains_all (AND logic), contains_any (OR logic), equal (exact set match)'),
      isNegated: z
        .boolean()
        .default(false)
        .describe('Set to true to exclude entities with these strings.'),
    },
    'Available only base array filter fields: operator, isNegated'
  )
  .strict()

const ArrayStringFilter = BaseArrayFilter.extend({
  value: z
    .array(z.string('Should be a string'), 'Should be an array of strings')
    .describe('Array of strings to match against.'),
})

const ColorArrayFilter = BaseArrayFilter.extend({
  value: z
    .array(zodColor, 'Should be an array of HEX color strings')
    .describe('Array of HEX color strings to match against.'),
})

const taskFilterObject = {
  ids: z.array(zodObjectId, 'Should be an array of object IDs').optional(),
  categoryIds: z.array(zodObjectId, 'Should be an array of object IDs').optional(),
  boardIds: z.array(zodObjectId, 'Should be an array of object IDs').optional(),
  workspaceIds: z.array(zodObjectId, 'Should be an array of object IDs').optional(),
  isCompleted: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  name: StringFilter.optional(),
  description: StringFilter.optional(),
  dueDate: DateFilter.optional(),
  dueTime: TimeFilter.optional(),
  tags: ArrayStringFilter.optional(),
  color: ColorArrayFilter.optional(),
  order: NumberFilter.optional(),

  and: andSchema.optional(),
  or: orSchema.optional(),
}

const TaskFilterSchema = z
  .object(
    taskFilterObject,
    'Available only task filter fields: ' + Object.keys(taskFilterObject).join(', ')
  )
  .strict()
  .describe(
    "Top-level fields are joined by logical AND. Use 'or'/'and' only for complex nested logic."
  )

type TaskFilterDTO = z.infer<typeof TaskFilterSchema>

const categoryFilterObject = {
  ids: z.array(zodObjectId, 'Should be an array of object IDs').optional(),

  boardIds: z.array(zodObjectId, 'Should be an array of object IDs').optional(),
  workspaceIds: z.array(zodObjectId, 'Should be an array of object IDs').optional(),
  isArchived: z.boolean().optional(),

  name: StringFilter.optional(),
  order: NumberFilter.optional(),

  and: andSchema.optional(),
  or: orSchema.optional(),
}

const CategoryFilterSchema = z
  .object(
    categoryFilterObject,
    'Available only category filter fields: ' + Object.keys(categoryFilterObject).join(', ')
  )
  .strict()
  .describe(
    "Top-level fields are joined by logical AND. Use 'or'/'and' only for complex nested logic."
  )

type CategoryFilterDTO = z.infer<typeof CategoryFilterSchema>

const boardFilterObject = {
  ids: z.array(zodObjectId, 'Should be an array of object IDs').optional(),
  workspaceIds: z.array(zodObjectId, 'Should be an array of object IDs').optional(),

  isArchived: z.boolean().optional(),

  name: StringFilter.optional(),
  order: NumberFilter.optional(),

  and: andSchema.optional(),
  or: orSchema.optional(),
}

const BoardFilterSchema = z
  .object(
    boardFilterObject,
    'Available only board filter fields: ' + Object.keys(boardFilterObject).join(', ')
  )
  .strict()
  .describe(
    "Top-level fields are joined by logical AND. Use 'or'/'and' only for complex nested logic."
  )

type BoardFilterDTO = z.infer<typeof BoardFilterSchema>

const workspaceFilterObject = {
  ids: z.array(zodObjectId, 'Should be an array of object IDs').optional(),

  isArchived: z.boolean().optional(),

  name: StringFilter.optional(),
  order: NumberFilter.optional(),

  and: andSchema.optional(),
  or: orSchema.optional(),
}
const WorkspaceFilterSchema = z
  .object(
    workspaceFilterObject,
    'Available only workspace filter fields: ' + Object.keys(workspaceFilterObject).join(', ')
  )
  .strict()
  .describe(
    "Top-level fields are joined by logical AND. Use 'or'/'and' only for complex nested logic."
  )

type WorkspaceFilterDTO = z.infer<typeof WorkspaceFilterSchema>

const stringModificationObject = {
  set: z.coerce.string().optional().describe('Replace the entire field value.'),
  append: z.coerce.string().optional().describe('Append text to the end of the current value.'),
  prepend: z.coerce
    .string()
    .optional()
    .describe('Prepend text to the beginning of the current value.'),
  replace_part: z
    .object(
      {
        find: z.coerce.string().describe('Must be an exact substring from the current text.'),
        replace_with: z.coerce.string().describe('String to replace the found substring with.'),
      },
      'should be an object with find and replace_with strings'
    )
    .strict()
    .optional()
    .describe('Find and replace part of the string.'),
}
const StringModificationSchema = z
  .object(
    stringModificationObject,
    'Available only string modification fields: ' + Object.keys(stringModificationObject).join(', ')
  )
  .strict()
  .describe('Instructions to modify a string field. Use only one property.')

// Блок для операций над полем даты (dueDate)
const dateModificationObject = {
  set: zodDueDate.optional().describe('Set an exact date. Format must be YYYY-MM-DD.'),
  shift: z
    .object({
      value: z.number().describe('Amount to shift'),
      unit: z.enum(['days', 'weeks', 'months', 'years']),
    })
    .optional(),
}
const DateModificationSchema = z
  .object(
    dateModificationObject,
    'Available only date modification fields: ' + Object.keys(dateModificationObject).join(', ')
  )
  .refine((data) => Object.keys(data).length <= 1, 'Only one modification operation is allowed.')
  .strict()
  .describe('Instructions to modify a date field. Use only one property.')

// Блок для операций над полем даты (dueDate)
const timeModificationObject = {
  set: zodDueTime.optional(),
  shift: z
    .object({
      value: z.number().describe('Amount to shift'),
      unit: z.enum(['hours', 'minutes']),
    })
    .optional(),
}
const TimeModificationSchema = z
  .object(
    timeModificationObject,
    'Available only time modification fields: ' + Object.keys(timeModificationObject).join(', ')
  )
  .refine((data) => Object.keys(data).length <= 1, 'Only one modification operation is allowed.')
  .strict()
  .describe('Instructions to modify a time field. Use only one property.')

// Блок для операций над массивом тегов (tags)
const tagsModificationObject = {
  set: z.array(z.string()).optional().describe('Replace the entire tags array.'),
  add: z
    .array(z.string())
    .optional()
    .describe('Add tags to the list (duplicates will be ignored).'),
  remove: z.array(z.string()).optional().describe('Remove tags from the list.'),
}
const TagsModificationSchema = z
  .object(
    tagsModificationObject,
    'Available only tags modification fields: ' + Object.keys(tagsModificationObject).join(', ')
  )
  .strict()
  .describe('Instructions to modify the tags array.')

const editTasksChangesObject = {
  name: StringModificationSchema.optional(),
  description: StringModificationSchema.nullable().optional(),
  dueDate: DateModificationSchema.nullable().optional(),
  dueTime: TimeModificationSchema.nullable().optional(),
  tags: TagsModificationSchema.nullable().optional(),
  categoryId: zodObjectId.optional(),
  isCompleted: z.boolean().optional(),
  color: zodColor.nullable().optional(),
  order: zodOrder.nullable().optional(),
}

const editTasksObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids'
    )
    .strict()
    .describe('Filter tasks to edit.'),

  changes: z
    .object(
      editTasksChangesObject,
      'Available only task changes fields: ' + Object.keys(editTasksChangesObject).join(', ')
    )
    .strict()
    .describe('Object with changes to apply to the found tasks.'),
}
const EditTasksSchema = z
  .object(
    editTasksObject,
    'Available only task modification fields: ' + Object.keys(editTasksObject).join(', ')
  )
  .strict()

type EditTasksDTO = z.infer<typeof EditTasksSchema>

const editCategoriesChangesObject = {
  name: StringModificationSchema.optional(),
  boardId: zodObjectId.optional(),
  order: zodOrder.nullable().optional(),
}
const editCategoriesObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of category IDs to edit.'),
      },
      'Available only category filter fields: ids'
    )
    .strict()
    .describe('Filter categories to edit.'),

  changes: z
    .object(
      editCategoriesChangesObject,
      'Available only category changes fields: ' +
        Object.keys(editCategoriesChangesObject).join(', ')
    )
    .strict()
    .describe('Object with changes to apply to the found categories.'),
}
const EditCategoriesSchema = z
  .object(
    editCategoriesObject,
    'Available only category modification fields: ' + Object.keys(editCategoriesObject).join(', ')
  )
  .strict()

type EditCategoriesDTO = z.infer<typeof EditCategoriesSchema>

const editBoardsChangesObject = {
  name: StringModificationSchema.optional(),
  isFavorite: z.boolean().optional(),
  workspaceId: zodObjectId.optional(),
  order: zodOrder.nullable().optional(),
}
const editBoardsObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of board IDs to filter.'),
      },
      'Available only board filter fields: ids'
    )
    .strict()
    .describe('Filter boards to edit.'),

  changes: z
    .object(
      editBoardsChangesObject,
      'Available only board changes fields: ' + Object.keys(editBoardsChangesObject).join(', ')
    )
    .strict()
    .describe('Object with changes to apply to the found boards.'),
}
const EditBoardsSchema = z
  .object(
    editBoardsObject,
    'Available only board modification fields: ' + Object.keys(editBoardsObject).join(', ')
  )
  .strict()

type EditBoardsDTO = z.infer<typeof EditBoardsSchema>

const editWorkspacesChangesObject = {
  name: StringModificationSchema.optional(),
  isFavorite: z.boolean().optional(),
  color: zodWorkspaceColor.optional(),
  order: zodOrder.nullable().optional(),
}
const editWorkspacesObject = {
  filter: z
    .object({
      ids: z.array(zodObjectId).describe('Array of workspace IDs to filter.'),
    })
    .strict()
    .describe('Filter workspaces to edit.'),

  changes: z
    .object(
      editWorkspacesChangesObject,
      'Available only workspace changes fields: ' +
        Object.keys(editWorkspacesChangesObject).join(', ')
    )
    .strict()
    .describe('Object with changes to apply to the found workspaces.'),
}

const EditWorkspacesSchema = z
  .object(
    editWorkspacesObject,
    'Available only workspace changes fields: ' + Object.keys(editWorkspacesObject).join(', ')
  )
  .strict()

type EditWorkspacesDTO = z.infer<typeof EditWorkspacesSchema>

const ShowEntitiesToUserSchema = z.object({
  ids: z.array(zodObjectId).describe('Array of entity IDs to show to the user.'),
  type: z.enum(['task', 'category', 'board', 'workspace']).describe('Type of entities to show.'),
})

type ShowEntitiesToUserDTO = z.infer<typeof ShowEntitiesToUserSchema>

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

const PlanToolSchema = z.object({
  steps: z
    .array(z.string())
    .describe('List of atomic steps/intents. Empty if no actionable intent.'),
})

export {
  TaskFilterSchema,
  TaskFilterDTO,
  CategoryFilterSchema,
  CategoryFilterDTO,
  BoardFilterSchema,
  BoardFilterDTO,
  WorkspaceFilterSchema,
  WorkspaceFilterDTO,
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
  ShowEntitiesToUserSchema,
  ShowEntitiesToUserDTO,
  GetChatHistorySchema,
  Plan,
  Step,
  PlanToolSchema,
}
