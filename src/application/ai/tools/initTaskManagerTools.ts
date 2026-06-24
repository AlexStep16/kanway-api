import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { SearchTasksScheme } from './schemes/TaskManager/SearchTasksScheme.js'
import { UpdateTasksScheme } from './schemes/TaskManager/UpdateTasksScheme.js'
import { DeleteArchiveTasksScheme } from './schemes/TaskManager/DeleteArchiveTasksScheme.js'
import { CloneTasksScheme } from './schemes/TaskManager/CloneTasksScheme.js'
import { RecoverTasksScheme } from './schemes/TaskManager/RecoverTasksScheme.js'
import { MoveTasksScheme } from './schemes/TaskManager/MoveTasksScheme.js'
import { CreateTasksScheme } from './schemes/TaskManager/CreateTasksScheme.js'
import { ReorderTasksScheme } from './schemes/TaskManager/ReorderTasksScheme.js'
import { SearchTasksSemanticScheme } from './schemes/TaskManager/SearchTasksSemanticScheme.js'

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

  const searchTasksSemantic = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.searchTasksSemantic(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'search_tasks_semantic',
      schema: SearchTasksSemanticScheme,
    },
  )

  const createTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.createTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'create_tasks',
      schema: CreateTasksScheme,
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

  const moveTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.moveTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'move_tasks',
      schema: MoveTasksScheme,
    },
  )

  const reorderTasks = tool(
    async (data, config) => {
      return await dependencies.services.taskToolsExecutorService.reorderTasks(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'reorder_tasks',
      schema: ReorderTasksScheme,
    },
  )

  return [
    searchTasks,
    searchTasksSemantic,
    createTasks,
    updateTasks,
    deleteArchiveTasks,
    cloneTasks,
    recoverTasks,
    moveTasks,
    reorderTasks,
  ]
}
