import { z } from 'zod'

export const GetSelectionDetailsScheme = z
  .object({
    selection_id: z.string(),
    fields_to_include: z
      .array(z.enum(['description', 'tags', 'is_favorite', 'color', 'createdAt', 'updatedAt']))
      .optional()
      .describe(
        'Additional fields to include in the output samples. Base fields - id, name, isCompleted, isDeleted - are always included if available.',
      ),
  })
  .describe(
    'Use this tool to retrieve the actual text content (titles, descriptions, names) of a previously searched dataset (selection_id). ' +
      'Use it ONLY when the user asks you to read, analyze, summarize, or list the specific items in that selection. ' +
      'NEVER use it if you are simply passing the selection to a Sub-Agent for bulk mutation.',
  )

export type GetSelectionDetailsDTO = z.infer<typeof GetSelectionDetailsScheme>
