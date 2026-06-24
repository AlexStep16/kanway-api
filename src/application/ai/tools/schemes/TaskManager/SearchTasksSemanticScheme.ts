import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'
import { checkBoardId } from '../commonSchemes.js'

export const SearchTasksSemanticScheme = z
  .object({
    query: z
      .string()
      .describe(
        'A free-text search query to match against task names and descriptions. Use Russian language for best results.',
      ),
    sample_limit: z
      .number()
      .default(3)
      .describe('The maximum number of tasks to return in the output sample.'),
    board_id: z
      .string(ErrorMessages.BOARD_ID_INVALID)
      .refine(checkBoardId, {
        message: 'Board ID does not exist.',
      })
      .describe('ID of the board to search tasks in.'),
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
    'Use this tool ONLY to perform semantic searches on tasks. It searches tasks based on their meaning rather than exact keyword matches.' +
      "This tool always generates a 'selection_id' for subsequent bulk mutations. " +
      'If the goal is to bulk update or delete tasks, KEEP the default sample_limit and fields_to_include to save tokens. ' +
      'If the goal is to read, list, summarize, or analyze tasks, explicitly set fields_to_include and increase sample_limit (up to 30).',
  )

export type SearchTasksSemanticDTO = z.infer<typeof SearchTasksSemanticScheme>
