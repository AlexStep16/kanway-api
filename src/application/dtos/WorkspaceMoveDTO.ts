import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const WorkspaceMoveDTOSchema = z.object({
  id: z.string(ErrorMessages.WORKSPACE_ID_INVALID).regex(objectIdRegex),
  beforeWorkspaceId: z
    .string(ErrorMessages.BEFORE_WORKSPACE_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterWorkspaceId: z
    .string(ErrorMessages.AFTER_WORKSPACE_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
})

export type WorkspaceMoveDTO = z.infer<typeof WorkspaceMoveDTOSchema>
