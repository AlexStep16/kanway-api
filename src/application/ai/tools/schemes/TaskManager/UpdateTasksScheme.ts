import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'
import z from 'zod'
import {
  ArrayUpdateSchema,
  DueDateUpdateSchema,
  DueHoursUpdateSchema,
  DueMinutesUpdateSchema,
  StringUpdateSchema,
} from '../updateSchemes.js'

const ColorUpdateSchema = z
  .object({
    value: z.enum(TASK_COLORS_TITLES).optional().describe('The color name.'),
    tone: z.enum(['light', 'medium', 'dark']).optional().describe('The tone/shade.'),
  })
  .nullable()
  .describe('Object to update the task color. Pass null to remove the color completely.')

export const UpdateTasksScheme = z.object({
  selection_id: z.string().optional().describe('Apply updates to this selection of tasks.'),
  task_ids: z.array(z.string()).optional().describe('Apply updates to these specific tasks only.'),

  updates: z.object({
    name: StringUpdateSchema.optional(),
    description: StringUpdateSchema.optional(),
    due_date: DueDateUpdateSchema.optional().describe('The date part of deadline.'),
    due_hours: DueHoursUpdateSchema.optional().describe('The hours part of deadline (0-23).'),
    due_minutes: DueMinutesUpdateSchema.optional().describe('The minutes part of deadline (0-59).'),
    is_completed: z.boolean().optional().describe('Directly overwrite status.'),
    color: ColorUpdateSchema.optional(),
    tags: ArrayUpdateSchema.optional().describe(
      'Update the array of tags associated with the task.',
    ),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Directly overwrite priority.'),
  }),
}).describe(`
  Tool to update tasks. You can specify a selection_id or multiple task_ids.
  For fields like 'name' and 'due_date', you can either overwrite them with a flat value,
  or perform operations like appending text or adding/subtracting days.
`)

export type UpdateTasksDTO = z.infer<typeof UpdateTasksScheme>
