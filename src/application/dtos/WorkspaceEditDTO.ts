import { z } from 'zod'
import { WorkspaceDTOSchema } from '@/application/dtos/WorkspaceDTO.ts'

export const WorkspaceEditDTOSchema = WorkspaceDTOSchema.partial({
  name: true,
  color: true,
})

export type WorkspaceEditDTO = z.infer<typeof WorkspaceEditDTOSchema>
