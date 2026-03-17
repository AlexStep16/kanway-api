import { z } from 'zod'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { WorkspaceEditDTOSchema } from './WorkspaceEditDTO.ts'

export const WorkspaceEditManyDTOSchema = z.array(WorkspaceEditDTOSchema, {
  error: ErrorMessages.WORKSPACE_BULK_UPDATE_INVALID,
})

export type WorkspaceEditManyDTO = z.infer<typeof WorkspaceEditManyDTOSchema>
