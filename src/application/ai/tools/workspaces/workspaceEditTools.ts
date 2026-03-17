import { tool } from '@langchain/core/tools'
import {
  EditWorkspacesColorSchema,
  EditWorkspacesNameSchema,
  EditWorkspacesOrderSchema,
  FavoriteWorkspacesSchema,
} from '../schemes/update/workspaceEditSchemes.ts'
import { WorkspaceEditToolAdapter } from '../adapters/workspaces/WorkspaceEditToolAdapter.ts'

export function createEditWorkspaceTools(adapter: WorkspaceEditToolAdapter) {
  const updateWorkspacesName = tool((args, config) => adapter.updateWorkspacesName(args, config), {
    name: 'updateWorkspacesName',
    schema: EditWorkspacesNameSchema,
  })

  const updateWorkspacesOrder = tool(
    (args, config) => adapter.updateWorkspacesOrder(args, config),
    {
      name: 'updateWorkspacesOrder',
      schema: EditWorkspacesOrderSchema,
    },
  )

  const updateWorkspacesColor = tool(
    (args, config) => adapter.updateWorkspacesColor(args, config),
    {
      name: 'updateWorkspacesColor',
      schema: EditWorkspacesColorSchema,
    },
  )

  const favoriteWorkspaces = tool((args, config) => adapter.favoriteWorkspaces(args, config), {
    name: 'favoriteWorkspaces',
    schema: FavoriteWorkspacesSchema,
  })

  return [updateWorkspacesName, updateWorkspacesOrder, updateWorkspacesColor, favoriteWorkspaces]
}
