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

const FilterValueSchema = z.union([ColorFilterValueSchema, z.any()])

export const SearchTasksScheme = z
  .object({
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
              'color',
              'is_deleted',
              'column_id',
              'column_selection_id',
              'board_id',
              'board_selection_id',
              'workspace_id',
              'workspace_selection_id',
              'created_at',
              'updated_at',
            ])
            .describe(
              'The task field to search (e.g. "is_completed", "due_date", "column_id", "color"). due_date is YYYY-MM-DD, due_time is HH:mm, created_at and updated_at are ISO 8601 datetime strings.',
            ),

          eq: FilterValueSchema.optional().describe(
            'Equals: Exact match. For color use { value?: colorName, tone?: light|medium|dark }.',
          ),
          neq: FilterValueSchema.optional().describe(
            'Not Equals: Exclude this value. For color use { value?: colorName, tone?: light|medium|dark }.',
          ),

          in: z
            .array(z.union([z.string(), z.number(), z.boolean()]))
            .optional()
            .describe('In: Array of allowed exact values.'),
          nin: z
            .array(z.union([z.string(), z.number(), z.boolean()]))
            .optional()
            .describe('Not In: Array of excluded values.'),

          cont: z
            .string()
            .optional()
            .describe('Contains: Substring match (useful for text/names).'),
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
          lte: z
            .string()
            .optional()
            .describe('Less than or equal. Strictly use ISO 8601 for dates.'),
        }),
      )
      .describe(
        'One filter criterion. Combine multiple criteria with AND logic in the filters array.',
      ),
    sample_limit: z
      .number()
      .default(3)
      .describe(
        'The maximum number of tasks to return in the output sample. ' +
          'Use a value greater than 3 (up to 30) ONLY when the orchestrator explicitly asks you to read, analyze, summarize, or list these tasks.',
      ),
    offset: z
      .number()
      .default(0)
      .describe(
        'The number of tasks to skip before returning the sample. ' +
          "Use this for pagination ONLY when you need to read the 'next' batch of tasks (e.g., if you already reviewed the first 30 tasks and the user asks for more). " +
          'Do NOT use offset in a continuous loop to scan the entire database.',
      ),
    fields_to_include: z
      .array(
        z.enum([
          'description',
          'tags',
          'color',
          'priority',
          'is_deleted',
          'is_external_deleted',
          'deleted_time',
          'createdAt',
          'updatedAt',
        ]),
      )
      .optional()
      .describe(
        'Additional detailed fields to include in the output sample. ' +
          'Use ONLY for data retrieval, reading, or analysis requests. ' +
          'By default, only lightweight fields (id, name, is_completed, due_date) are returned to save context budget.',
      ),
  })
  .describe(
    'Use this tool to search and filter tasks. ' +
      "This tool always generates a 'selection_id' for subsequent bulk mutations. " +
      'If the goal is to bulk update or delete tasks, KEEP the default sample_limit and fields_to_include to save tokens. ' +
      'If the goal is to read, list, summarize, or analyze tasks, explicitly set fields_to_include and increase sample_limit (up to 30).',
  )

export type SearchTasksDTO = z.infer<typeof SearchTasksScheme>
