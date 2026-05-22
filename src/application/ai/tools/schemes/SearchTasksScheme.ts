import z from 'zod'

export const SearchTasksScheme = z.object({
  filters: z
    .array(
      z.object({
        field: z
          .string()
          .describe('The task field to search (e.g. "is_completed", "due_date", "category_id").'),

        eq: z.string().optional().describe('Equals: Exact match.'),
        neq: z.string().optional().describe('Not Equals: Exclude this value.'),

        in: z.array(z.string()).optional().describe('In: Array of allowed exact values.'),
        nin: z.array(z.string()).optional().describe('Not In: Array of excluded values.'),

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
