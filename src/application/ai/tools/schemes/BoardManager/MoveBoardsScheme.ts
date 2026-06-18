import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'
import { checkWorkspaceId } from '../commonSchemes.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const MoveBoardsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  board_ids: z.array(z.string()).optional().describe('Target board ids.'),
  beforeBoardId: z.string(ErrorMessages.BEFORE_BOARD_ID_INVALID).regex(objectIdRegex).optional(),
  afterBoardId: z.string(ErrorMessages.AFTER_BOARD_ID_INVALID).regex(objectIdRegex).optional(),
  newWorkspaceId: z
    .string(ErrorMessages.WORKSPACE_ID_INVALID)
    .refine(checkWorkspaceId, {
      message: 'Workspace ID does not exist.',
    })
    .regex(objectIdRegex)
    .optional(),
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
}).describe(`
  Move boards.
  Pass selection_id or board_ids.
`)

export type MoveBoardsDTO = z.infer<typeof MoveBoardsScheme>
