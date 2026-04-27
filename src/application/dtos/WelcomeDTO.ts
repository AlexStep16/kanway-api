import { z } from 'zod'
import { WorkspaceDTOSchema } from './WorkspaceDTO.js'
import { UserDTOSchema } from './UserDTO.js'

export const WelcomeDTOSchema = z.object({
  workspaceName: WorkspaceDTOSchema.shape.name,
  workspaceColor: WorkspaceDTOSchema.shape.color,
  username: UserDTOSchema.shape.username,
})

export type WelcomeDTO = z.infer<typeof WelcomeDTOSchema>
