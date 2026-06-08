import z from 'zod'
import { checkColumnId, ColorScheme } from '../commonSchemes.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export const CreateTasksScheme = z.object({
  tasks: z.array(
    z.object({
      name: z.string().describe('The new name of the task.'),
      column_id: z
        .string(ErrorMessages.COLUMN_ID_INVALID)
        .refine(checkColumnId, {
          message: 'Column ID does not exist.',
        })
        .describe('ID of the column to move the task into.'),
      description: z.string().optional().describe('The new description of the task.'),
      due_date: z.iso
        .date()
        .optional()
        .describe('The date part of deadline. ISO Date string without time component.'),
      due_hours: z.number().optional().describe('The hours part of deadline (0-23).'),
      due_minutes: z.number().optional().describe('The minutes part of deadline (0-59).'),
      is_completed: z.boolean().optional().describe('Directly overwrite status.'),
      color: ColorScheme.optional().describe('The new color of the task.'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Update the array of tags associated with the task.'),
      priority: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .describe('Directly overwrite priority.'),
    }),
  ),
}).describe(`
  Tool to create tasks. You can specify multiple tasks to be created at once.
  Required fields are 'name' and 'column_id'.
`)

export type CreateTasksDTO = z.infer<typeof CreateTasksScheme>
