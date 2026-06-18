import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const WorkspaceMoveManyDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.WORKSPACE_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.WORKSPACE_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.WORKSPACE_BULK_UPDATE_INVALID),
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
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
})

export type WorkspaceMoveManyDTO = z.infer<typeof WorkspaceMoveManyDTOSchema>
