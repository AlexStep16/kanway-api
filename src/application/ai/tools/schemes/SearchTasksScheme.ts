import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'
import z from 'zod'

const ColorFilterValueSchema = z
  .object({
    value: z.enum(TASK_COLORS_TITLES).optional().describe('The task color name.'),
    tone: z.enum(['light', 'medium', 'dark']).optional().describe('The task color tone.'),
  })
  .refine((color) => color.value || color.tone, {
    message: 'At least one of color value or tone must be provided.',
  })

const FilterValueSchema = z.union([z.string(), ColorFilterValueSchema])

export const SearchTasksScheme = z.object({
  filters: z
    .array(
      z.object({
        field: z
          .enum([
            'id',
            'name',
            'description',
            'is_completed',
            'due_date',
            'due_time',
            'tags',
            'order',
            'color',
            'is_deleted',
            'is_favorite',
            'category_id',
            'category_selection_id',
            'board_id',
            'board_selection_id',
            'workspace_id',
            'workspace_selection_id',
            'created_at',
            'updated_at',
          ])
          .describe(
            'The task field to search (e.g. "is_completed", "due_date", "category_id", "color"). due_date is YYYY-MM-DD, due_time is HH:mm, created_at and updated_at are ISO 8601 datetime strings.',
          ),

        eq: FilterValueSchema.optional().describe(
          'Equals: Exact match. For color use { value?: colorName, tone?: light|medium|dark }.',
        ),
        neq: FilterValueSchema.optional().describe(
          'Not Equals: Exclude this value. For color use { value?: colorName, tone?: light|medium|dark }.',
        ),

        in: z.array(FilterValueSchema).optional().describe('In: Array of allowed exact values.'),
        nin: z.array(FilterValueSchema).optional().describe('Not In: Array of excluded values.'),

        cont: z.string().optional().describe('Contains: Substring match (useful for text/names).'),
        ncont: z.string().optional().describe('Not Contains: Exclude substring.'),
        contany: z
          .array(z.string())
          .optional()
          .describe('Contains Any: Match any substring in the array.'),
        ncontany: z
          .array(z.string())
          .optional()
          .describe('Not Contains Any: Exclude if any substring in the array matches.'),

        gt: z.string().optional().describe('Greater than. Strictly use ISO 8601 for dates.'),
        gte: z
          .string()
          .optional()
          .describe('Greater than or equal. Strictly use ISO 8601 for dates.'),
        lt: z.string().optional().describe('Less than. Strictly use ISO 8601 for dates.'),
        lte: z.string().optional().describe('Less than or equal. Strictly use ISO 8601 for dates.'),
      }),
    )
    .describe(
      'One filter criterion. Combine multiple criteria with AND logic in the filters array.',
    ),
}).describe(`
  Tool for searching tasks. 
  Construct an array of criteria objects. 
  Multiple objects in the array are combined with AND logic. 
  Provide ONLY ONE operator (eq, in, gt, etc.) per object.
`)

export type SearchTasksDTO = z.infer<typeof SearchTasksScheme>
