import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const WorkspaceReorderDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.WORKSPACE_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.WORKSPACE_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.WORKSPACE_BULK_UPDATE_INVALID),
})

export type WorkspaceReorderDTO = z.infer<typeof WorkspaceReorderDTOSchema>
