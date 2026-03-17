import z from 'zod'
import { zodName, zodOrder, zodWorkspaceColor } from '../baseSchemes.ts'

const workspaceFieldsObject = {
  name: zodName.describe('Workspace name. Should be clear and concise.'),
  isFavorite: z.boolean().default(false),
  color: zodWorkspaceColor,
  order: zodOrder.optional(),
}

export const WorkspaceCreateSchema = z
  .object(
    {
      workspaces: z.array(
        z.object(
          workspaceFieldsObject,
          'Available only workspace creation fields: ' +
            Object.keys(workspaceFieldsObject).join(', '),
        ),
        'Must be an array of workspaces to create',
      ),
    },
    'Available only workspaces field',
  )
  .strict()

export type WorkspaceCreateDTO = z.infer<typeof WorkspaceCreateSchema>
