import z from 'zod'

export const SearchBoardsScheme = z
  .object({
    filters: z
      .array(
        z.object({
          field: z
            .enum([
              'id',
              'name',
              'is_deleted',
              'is_favorite',
              'workspace_id',
              'workspace_selection_id',
              'columns_count',
              'tasks_count',
              'created_at',
              'updated_at',
            ])
            .describe(
              'The board field to search (e.g. "name", "is_deleted", "workspace_id"). created_at and updated_at are ISO 8601 datetime strings',
            ),

          eq: z.any().optional().describe('Equals: Exact match.'),
          neq: z.any().optional().describe('Not Equals: Exclude this value.'),

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
        'One filter criterion. Combine multiple criteria with AND logic in the filters array',
      ),
    offset: z
      .number()
      .default(0)
      .describe(
        'The number of tasks to skip before returning the sample. ' +
          "Use this for pagination ONLY when you need to read the 'next' batch of tasks (e.g., if you already reviewed the first 30 tasks and the user asks for more). " +
          'Do NOT use offset in a continuous loop to scan the entire database',
      ),
    sample_limit: z
      .number()
      .default(3)
      .describe(
        'The maximum number of boards to return in the output sample. ' +
          'Use a value greater than 3 (up to 30) ONLY when the orchestrator explicitly asks you to read, analyze, summarize, or list these boards',
      ),
    fields_to_include: z
      .array(
        z.enum([
          'is_favorite',
          'is_deleted',
          'is_deleted_external',
          'deleted_time',
          'createdAt',
          'updatedAt',
        ]),
      )
      .optional()
      .describe(
        'Additional detailed fields to include in the output sample. ' +
          'Use ONLY for data retrieval, reading, or analysis requests. ' +
          'By default, only lightweight fields (id, name, workspace_id) are returned to save context budget',
      ),
  })
  .describe(
    'Use this tool to search and filter boards. ' +
      "This tool always generates a 'selection_id' for subsequent bulk mutations. " +
      'If the goal is to bulk update or delete boards, KEEP the default sample_limit and fields_to_include to save tokens. ' +
      'If the goal is to read, list, summarize, or analyze boards, explicitly set fields_to_include and increase sample_limit (up to 30)',
  )

export type SearchBoardsDTO = z.infer<typeof SearchBoardsScheme>
