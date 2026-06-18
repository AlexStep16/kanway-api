import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { SearchColumnsScheme } from './schemes/ColumnManager/SearchColumnsScheme.js'
import { UpdateColumnsScheme } from './schemes/ColumnManager/UpdateColumnsScheme.js'
import { DeleteArchiveColumnsScheme } from './schemes/ColumnManager/DeleteArchiveColumnsScheme.js'
import { CloneColumnsScheme } from './schemes/ColumnManager/CloneColumnsScheme.js'
import { RecoverColumnsScheme } from './schemes/ColumnManager/RecoverColumnsScheme.js'
import { MoveColumnsScheme } from './schemes/ColumnManager/MoveColumnsScheme.js'
import { CreateColumnsScheme } from './schemes/ColumnManager/CreateColumnsScheme.js'
import { ReorderColumnsScheme } from './schemes/ColumnManager/ReorderColumnsScheme.js'

export function initColumnManagerTools(
  dependencies: AgentDependencies,
  runnableConfig: RunnableConfig,
) {
  const searchColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.searchColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'search_columns',
      schema: SearchColumnsScheme,
    },
  )

  const createColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.createColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'create_columns',
      schema: CreateColumnsScheme,
    },
  )

  const updateColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.updateColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'update_columns',
      schema: UpdateColumnsScheme,
    },
  )

  const deleteArchiveColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.deleteArchiveColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'delete_archive_columns',
      schema: DeleteArchiveColumnsScheme,
    },
  )

  const cloneColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.cloneColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'clone_columns',
      schema: CloneColumnsScheme,
    },
  )

  const recoverColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.recoverColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'recover_columns',
      schema: RecoverColumnsScheme,
    },
  )

  const moveColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.moveColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'move_columns',
      schema: MoveColumnsScheme,
    },
  )

  const reorderColumns = tool(
    async (data, config) => {
      return await dependencies.services.columnToolsExecutorService.reorderColumns(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'reorder_columns',
      schema: ReorderColumnsScheme,
    },
  )

  return [
    searchColumns,
    createColumns,
    updateColumns,
    deleteArchiveColumns,
    cloneColumns,
    recoverColumns,
    moveColumns,
    reorderColumns,
  ]
}
