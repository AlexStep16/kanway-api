import { z } from 'zod'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { WorkspaceEditDTOSchema } from './WorkspaceEditDTO.js'

export const WorkspaceEditManyDTOSchema = z.array(WorkspaceEditDTOSchema, {
  error: ErrorMessages.WORKSPACE_BULK_UPDATE_INVALID,
})

export type WorkspaceEditManyDTO = z.infer<typeof WorkspaceEditManyDTOSchema>
