import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'
import { CreateWorkspaceDTOSchema } from './CreateWorkspacesDTO.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const UpdateWorkspaceDTOSchema = CreateWorkspaceDTOSchema.partial()
  .extend({
    _id: z
      .string(ErrorMessages.WORKSPACE_ID_INVALID)
      .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
  })
  .strict()

export const UpdateWorkspacesDTOSchema = z.object({
  updates: UpdateWorkspaceDTOSchema.array(),
})

export type UpdateWorkspacesDTO = z.infer<typeof UpdateWorkspacesDTOSchema>
