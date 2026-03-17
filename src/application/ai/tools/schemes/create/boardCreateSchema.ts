import z from 'zod'
import { zodName, zodObjectId, zodOrder } from '../baseSchemes.ts'

const boardFieldsObject = {
  name: zodName.describe('Board name. Should be clear and concise.'),
  workspaceName: z.string().optional().describe('Semantic name to search for.'),
  workspaceId: zodObjectId.optional().describe('Use only if known or resolved after a prompt.'),
  isFavorite: z.boolean().default(false),
  order: zodOrder.optional(),
}

export const BoardCreateSchema = z
  .object(
    {
      boards: z.array(
        z.object(
          boardFieldsObject,
          'Available only board creation fields: ' + Object.keys(boardFieldsObject).join(', '),
        ),
        'Must be an array of boards to create',
      ),
    },
    'Available only boards field',
  )
  .strict()

export type BoardCreateDTO = z.infer<typeof BoardCreateSchema>
