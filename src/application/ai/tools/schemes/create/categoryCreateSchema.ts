import z from 'zod'
import { zodName, zodObjectId, zodOrder } from '../baseSchemes.ts'

const categoryFieldsObject = {
  name: zodName.describe('Category name. Should be clear and concise.'),
  boardName: z.string().optional().describe('Semantic name to search for.'),
  boardId: zodObjectId.optional().describe('Use only if known or resolved after a prompt.'),
  workspaceName: z.string().optional().describe('Semantic name to search for.'),
  workspaceId: zodObjectId.optional().describe('Use only if known or resolved after a prompt.'),
  order: zodOrder.optional(),
}

export const CategoryCreateSchema = z
  .object(
    {
      categories: z.array(
        z.object(
          categoryFieldsObject,
          'Available only category creation fields: ' +
            Object.keys(categoryFieldsObject).join(', '),
        ),
        'Must be an array of categories to create',
      ),
    },
    'Available only categories field',
  )
  .strict()
  .describe(
    'If the user does not provide board then create the board with default board name but first try semantic search for some boards.',
  )

export type CategoryCreateDTO = z.infer<typeof CategoryCreateSchema>
