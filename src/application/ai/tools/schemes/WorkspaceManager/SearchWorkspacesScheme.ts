import { BASE_COLORS_MAP } from '@/constants/BASE_COLORS.js'
import z from 'zod'

const FilterValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.any())])

export const SearchWorkspacesScheme = z.object({
  filters: z
    .array(
      z.object({
        field: z
          .enum([
            'id',
            'name',
            'is_deleted',
            'color',
            'is_favorite',
            'boards_count',
            'columns_count',
            'tasks_count',
            'created_at',
            'updated_at',
          ])
          .describe(
            'The column field to search (e.g. "name", "is_deleted", "color"). created_at and updated_at are ISO 8601 datetime strings. Colors available: ' +
              Object.values(BASE_COLORS_MAP)
                .map((color) => color.name)
                .join(', '),
          ),

        eq: FilterValueSchema.optional().describe('Equals: Exact match.'),
        neq: FilterValueSchema.optional().describe('Not Equals: Exclude this value.'),

        in: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe('In: Array of allowed exact values.'),
        nin: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe('Not In: Array of excluded values.'),

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

  fields_to_include: z
    .array(z.enum(['is_favorite', 'color', 'createdAt', 'updatedAt']))
    .optional()
    .describe(
      'Additional fields to include in the output samples. Base fields - id, name - are always included if available.',
    ),
}).describe(`
  Tool for searching workspaces. 
  Construct an array of criteria objects. 
  Multiple objects in the array are combined with AND logic. 
  Provide ONLY ONE operator (eq, in, gt, etc.) per object.
`)

export type SearchWorkspacesDTO = z.infer<typeof SearchWorkspacesScheme>
