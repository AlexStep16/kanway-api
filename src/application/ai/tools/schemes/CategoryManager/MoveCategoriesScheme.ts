import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const MoveCategoriesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  category_ids: z.array(z.string()).optional().describe('Target category ids.'),
  beforeCategoryId: z
    .string(ErrorMessages.BEFORE_CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the category before which to move the selected categories.'),
  afterCategoryId: z
    .string(ErrorMessages.AFTER_CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the category after which to move the selected categories.'),
  newBoardId: z
    .string(ErrorMessages.BOARD_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the new board to move the categories to.'),
  toStart: z.boolean().optional().describe('Move to the start of the category.'),
  toEnd: z.boolean().optional().describe('Move to the end of the category.'),
}).describe(`
  Move categories.
  Pass selection_id or category_ids.
`)

export type MoveCategoriesDTO = z.infer<typeof MoveCategoriesScheme>
