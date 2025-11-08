import { z } from 'zod'
import { WorkspaceDTOSchema } from '@/application/dtos/WorkspaceDTO.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const WorkspaceEditDTOSchema = WorkspaceDTOSchema.partial().extend({
  id: z
    .string(ErrorsMessage.WORKSPACE_ID_INVALID)
    .regex(objectIdRegex, ErrorsMessage.WORKSPACE_ID_INVALID),
  isReorderNeeded: z.boolean('Неверное значение для флага пересортировки').optional(),
})

export type WorkspaceEditDTO = z.infer<typeof WorkspaceEditDTOSchema>
