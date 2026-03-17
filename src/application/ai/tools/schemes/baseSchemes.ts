import { BASE_COLORS } from '@/constants/BASE_COLORS.ts'
import { TASK_COLORS_MAP } from '@/constants/TASK_COLORS.ts'
import dayjs from 'dayjs'
import z from 'zod'

export const zodName = z
  .string()
  .min(1, 'Name must be at least 1 character long')
  .max(100, 'Name must be at most 100 characters long')
export const zodDescription = z.string().max(300, 'Description must be at most 300 characters long')
export const zodColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a HEX code (e.g., #A1B2C3)')
  .describe('HEX color code')
export const zodWorkspaceColor = z
  .enum(BASE_COLORS, 'Color must be one of the predefined base colors: ' + BASE_COLORS.join(', '))
  .default(BASE_COLORS[3])
  .describe('HEX color code')
export const zodOrder = z.coerce
  .number()
  .describe('Order must be a number representing the position.')
export const zodTags = z.array(z.string())
export const zodIsNegated = z
  .boolean()
  .default(false)
  .describe('Set to true for "EXCEPT" or "NOT" conditions.')

export const zodDueDate = z
  .string()
  .refine((val) => {
    return dayjs(val, 'YYYY-MM-DD', true).isValid()
  })
  .describe('Date in YYYY-MM-DD format.')

export const zodDueTime = z
  .string()
  .refine((val) => {
    return dayjs(val, 'HH:mm', true).isValid()
  })
  .describe('Time in HH:mm format.')

export const zodObjectId = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: 'Invalid ObjectId format',
  })
  .describe('The unique 24-char hex ID')

export const operators = z
  .enum(['eq', 'neq', 'in', 'nin', 'cont', 'contany', 'notcont', 'gt', 'lt'])
  .describe(
    'eq/neq: exact match; ' +
      'gt/lt: dates and numbers; ' +
      'cont/notcont: string substring OR search item inside array (tags); ' +
      'in/nin: field value is one of the provided list items',
  )

export type OperatorDTO = z.infer<typeof operators>

const taskColorsMap: Set<string> = new Set()

for (const [, color] of Object.entries(TASK_COLORS_MAP)) {
  taskColorsMap.add(color.name)
}

const zodTaskColors = z.enum([...taskColorsMap], {
  error: (iss) =>
    iss.input === undefined ? 'Color field is required.' : 'Invalid value for color.',
})

export const zodTaskColor = z.object({
  color: zodTaskColors,
  tone: z
    .enum(['light', 'dark'], {
      error: (iss) =>
        iss.input === undefined ? 'Tone field is required.' : 'Invalid value for tone.',
    })
    .optional(),
})

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
      'should be an object with find and replace_with strings',
    )
    .strict()
    .optional()
    .describe('Find and replace part of the string.'),
}

export const StringModificationSchema = z
  .object(
    stringModificationObject,
    'Available only string modification fields: ' +
      Object.keys(stringModificationObject).join(', '),
  )
  .strict()
  .describe('Instructions to modify a string field. Use only one property.')

export type StringModificationDTO = z.infer<typeof StringModificationSchema>

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

export const DateModificationSchema = z
  .object(
    dateModificationObject,
    'Available only date modification fields: ' + Object.keys(dateModificationObject).join(', '),
  )
  .refine((data) => Object.keys(data).length <= 1, 'Only one modification operation is allowed.')
  .strict()
  .describe('Instructions to modify a date field. Use only one property.')

export type DateModificationDTO = z.infer<typeof DateModificationSchema>

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

export const TimeModificationSchema = z
  .object(
    timeModificationObject,
    'Available only time modification fields: ' + Object.keys(timeModificationObject).join(', '),
  )
  .refine((data) => Object.keys(data).length <= 1, 'Only one modification operation is allowed.')
  .strict()
  .describe('Instructions to modify a time field. Use only one property.')

export type TimeModificationDTO = z.infer<typeof TimeModificationSchema>

// Блок для операций над массивом тегов (tags)
const tagsModificationObject = {
  set: z.array(z.string()).optional().describe('Replace the entire tags array.'),
  add: z
    .array(z.string())
    .optional()
    .describe('Add tags to the list (duplicates will be ignored).'),
  remove: z.array(z.string()).optional().describe('Remove tags from the list.'),
}

export const TagsModificationSchema = z
  .object(
    tagsModificationObject,
    'Available only tags modification fields: ' + Object.keys(tagsModificationObject).join(', '),
  )
  .strict()
  .describe('Instructions to modify the tags array.')

export type TagsModificationDTO = z.infer<typeof TagsModificationSchema>

const ShowEntitiesToUserSchema = z.object({
  ids: z.array(zodObjectId).describe('Array of entity IDs to show to the user.'),
  type: z.enum(['task', 'category', 'board', 'workspace']).describe('Type of entities to show.'),
})

type ShowEntitiesToUserDTO = z.infer<typeof ShowEntitiesToUserSchema>

const Step = z.object({
  description: z
    .string()
    .describe(
      "Описание одного атомарного действия, которое может быть выполнено одним инструментом. Разбивайте сложные запросы на несколько последовательных коротких шагов. Не объединяйте действия, такие как 'найти задачи для их удаления'. Например, 'удалить соответствующие задачи' должно быть двумя шагами: 'найти соответствующие задачи', а затем 'удалить найденные задачи'.",
    ),
})

const Plan = z.object({
  steps: z
    .array(Step)
    .describe(
      "Массив логических шагов для выполнения запроса пользователя. Шаги должны быть максимально короткими и описательными. Например, 'найти задачу', 'создать категорию', 'изменить задачу' и т.д.",
    ),
})

const PlanToolSchema = z.object({
  steps: z
    .array(z.string())
    .describe('List of atomic steps/intents. Empty if no actionable intent.'),
})

export { ShowEntitiesToUserSchema, ShowEntitiesToUserDTO, Plan, Step, PlanToolSchema }
