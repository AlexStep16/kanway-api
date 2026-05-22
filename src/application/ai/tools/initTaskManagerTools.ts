import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { SuccessToolResult } from './helpers/SuccessToolResult.js'
import z from 'zod'
import { SearchTasksScheme } from './schemes/searchTasksScheme.js'

export function initTaskManagerTools(dependencies: AgentDependencies, config: RunnableConfig) {
  const searchTasks = tool(
    async (data) => {
      return await dependencies.services.taskToolsExecutorService.searchTasks(data, config)
    },
    {
      name: 'search_tasks',
      schema: SearchTasksScheme,
    },
  )

  const returnFromTaskManagerAgent = tool(
    (data) => {
      return new SuccessToolResult(data)
    },
    {
      name: 'return_from_task_manager_agent',
      schema: z.object({
        reason: z
          .string()
          .describe(
            'The reason for returning from the Task Manager Agent. This can be used to indicate the completion of a task or to provide an explanation for returning.',
          ),
      }),
    },
  )

  return [searchTasks, returnFromTaskManagerAgent]
}
