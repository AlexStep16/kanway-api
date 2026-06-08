import z from 'zod'
import { checkWorkspaceId } from '../commonSchemes.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export const CreateBoardsScheme = z.object({
  boards: z.array(
    z.object({
      name: z.string().describe('The new name of the board.'),
      workspace_id: z
        .string(ErrorMessages.WORKSPACE_ID_INVALID)
        .refine(checkWorkspaceId, {
          message: 'Workspace ID does not exist.',
        })
        .describe('ID of the workspace to move the board into.'),
      is_favorite: z.boolean().optional().describe('Whether the board is a favorite.'),
    }),
  ),
}).describe(`
  Tool to create boards. You can specify multiple boards to be created at once.
  Required fields are 'name' and 'workspace_id'.
`)

export type CreateBoardsDTO = z.infer<typeof CreateBoardsScheme>
