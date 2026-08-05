import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ReorderBoardsScheme = z.object({
  workspace_id: z
    .string(ErrorMessages.WORKSPACE_ID_INVALID)
    .regex(objectIdRegex)
    .describe('ID of the workspace where boards are being reordered.'),
  selection_id: z.string().optional().describe('Target selection id.'),
  board_ids: z
    .array(z.string())
    .describe(
      'The complete list of ALL board IDs in this workspace, ordered in the exact sequence they should appear',
    ),
}).describe(`
  Reorder all boards in a specific workspace. 
  Pass the complete list of board IDs in the desired target order.
`)

export type ReorderBoardsDTO = z.infer<typeof ReorderBoardsScheme>
