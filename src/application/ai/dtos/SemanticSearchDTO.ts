import { z } from 'zod'

export const SemanticSearchDTOSchema = z
  .object({
    query: z
      .string('Should be a string')
      .min(1, 'Query cannot be empty')
      .max(255, 'Query is too long')
      .describe('The user query to perform semantic search on.'),
    entity_type: z
      .enum(
        ['task', 'board', 'category', 'workspace'],
        "The type should be one of 'task', 'board', 'category', 'workspace'",
      )
      .describe('The type of entity to search for.'),
    show_full_schema: z
      .boolean('Should be a boolean')
      .default(false)
      .describe('Whether to return the full entity schema or just a short fields.'),
  })
  .strict()

export type SemanticSearchDTO = z.infer<typeof SemanticSearchDTOSchema>
