import { z } from 'zod'
import { WorkspaceDTOSchema } from '@/application/dtos/WorkspaceDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const WorkspaceEditDTOSchema = WorkspaceDTOSchema.partial().extend({
  id: z
    .string(ErrorMessages.WORKSPACE_ID_INVALID)
    .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
})

export type WorkspaceEditDTO = z.infer<typeof WorkspaceEditDTOSchema>
