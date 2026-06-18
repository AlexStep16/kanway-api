import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const MoveWorkspacesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  workspace_ids: z.array(z.string()).optional().describe('Target workspace ids.'),
  beforeWorkspaceId: z
    .string(ErrorMessages.BEFORE_WORKSPACE_ID_INVALID)
    .regex(objectIdRegex)
    .optional(),
  afterWorkspaceId: z
    .string(ErrorMessages.AFTER_WORKSPACE_ID_INVALID)
    .regex(objectIdRegex)
    .optional(),
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
}).describe(`
  Move workspaces.
  Pass selection_id or workspace_ids.
`)

export type MoveWorkspacesDTO = z.infer<typeof MoveWorkspacesScheme>
