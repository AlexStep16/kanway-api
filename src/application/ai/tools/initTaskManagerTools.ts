import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { SearchTasksScheme } from './schemes/SearchTasksScheme.js'
import { UpdateTasksScheme } from './schemes/UpdateTasksScheme.js'
import { DeleteArchiveTasksScheme } from './schemes/DeleteArchiveTasksScheme.js'
import { CloneTasksScheme } from './schemes/CloneTasksScheme.js'
import { RecoverTasksScheme } from './schemes/RecoverTasksScheme.js'

export function initTaskManagerTools(
  dependencies: AgentDependencies,
  runnableConfig: RunnableConfig,
) {
  const searchTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.searchTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'search_tasks',
      schema: SearchTasksScheme,
    },
  )

  const updateTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.updateTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'update_tasks',
      schema: UpdateTasksScheme,
    },
  )

  const deleteArchiveTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.deleteArchiveTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'delete_archive_tasks',
      schema: DeleteArchiveTasksScheme,
    },
  )

  const cloneTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.cloneTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'clone_tasks',
      schema: CloneTasksScheme,
    },
  )

  const recoverTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.recoverTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'recover_tasks',
      schema: RecoverTasksScheme,
    },
  )

  return [searchTasks, updateTasks, deleteArchiveTasks, cloneTasks, recoverTasks]
}
