import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { SearchTasksScheme } from './schemes/SearchTasksScheme.js'
import { UpdateTasksScheme } from './schemes/UpdateTasksScheme.js'

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

  return [searchTasks, updateTasks]
}
