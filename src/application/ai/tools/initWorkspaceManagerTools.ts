import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { UpdateWorkspacesScheme } from './schemes/WorkspaceManager/UpdateWorkspacesScheme.js'
import { DeleteArchiveWorkspacesScheme } from './schemes/WorkspaceManager/DeleteArchiveWorkspacesScheme.js'
import { CloneWorkspacesScheme } from './schemes/WorkspaceManager/CloneWorkspacesScheme.js'
import { RecoverWorkspacesScheme } from './schemes/WorkspaceManager/RecoverWorkspacesScheme.js'
import { SearchWorkspacesScheme } from './schemes/WorkspaceManager/SearchWorkspacesScheme.js'

export function initWorkspaceManagerTools(
  dependencies: AgentDependencies,
  runnableConfig: RunnableConfig,
) {
  const searchWorkspaces = tool(
    async (data, config) => {
      return await dependencies.services.workspaceToolsExecutorService.searchWorkspaces(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'search_workspaces',
      schema: SearchWorkspacesScheme,
    },
  )

  const updateWorkspaces = tool(
    async (data, config) => {
      return await dependencies.services.workspaceToolsExecutorService.updateWorkspaces(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'update_workspaces',
      schema: UpdateWorkspacesScheme,
    },
  )

  const deleteArchiveWorkspaces = tool(
    async (data, config) => {
      return await dependencies.services.workspaceToolsExecutorService.deleteArchiveWorkspaces(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'delete_archive_workspaces',
      schema: DeleteArchiveWorkspacesScheme,
    },
  )

  const cloneWorkspaces = tool(
    async (data, config) => {
      return await dependencies.services.workspaceToolsExecutorService.cloneWorkspaces(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'clone_workspaces',
      schema: CloneWorkspacesScheme,
    },
  )

  const recoverWorkspaces = tool(
    async (data, config) => {
      return await dependencies.services.workspaceToolsExecutorService.recoverWorkspaces(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'recover_workspaces',
      schema: RecoverWorkspacesScheme,
    },
  )

  return [
    searchWorkspaces,
    updateWorkspaces,
    deleteArchiveWorkspaces,
    cloneWorkspaces,
    recoverWorkspaces,
  ]
}
