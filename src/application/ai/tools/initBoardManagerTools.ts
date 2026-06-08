import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { UpdateBoardsScheme } from './schemes/BoardManager/UpdateBoardsScheme.js'
import { DeleteArchiveBoardsScheme } from './schemes/BoardManager/DeleteArchiveBoardsScheme.js'
import { CloneBoardsScheme } from './schemes/BoardManager/CloneBoardsScheme.js'
import { RecoverBoardsScheme } from './schemes/BoardManager/RecoverBoardsScheme.js'
import { MoveBoardsScheme } from './schemes/BoardManager/MoveBoardsScheme.js'
import { SearchBoardsScheme } from './schemes/BoardManager/SearchBoardsScheme.js'
import { CreateBoardsScheme } from './schemes/BoardManager/CreateBoardsScheme.js'

export function initBoardManagerTools(
  dependencies: AgentDependencies,
  runnableConfig: RunnableConfig,
) {
  const searchBoards = tool(
    async (data, config) => {
      return await dependencies.services.boardToolsExecutorService.searchBoards(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'search_boards',
      schema: SearchBoardsScheme,
    },
  )

  const createBoards = tool(
    async (data, config) => {
      return await dependencies.services.boardToolsExecutorService.createBoards(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'create_boards',
      schema: CreateBoardsScheme,
    },
  )

  const updateBoards = tool(
    async (data, config) => {
      return await dependencies.services.boardToolsExecutorService.updateBoards(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'update_boards',
      schema: UpdateBoardsScheme,
    },
  )

  const deleteArchiveBoards = tool(
    async (data, config) => {
      return await dependencies.services.boardToolsExecutorService.deleteArchiveBoards(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'delete_archive_boards',
      schema: DeleteArchiveBoardsScheme,
    },
  )

  const cloneBoards = tool(
    async (data, config) => {
      return await dependencies.services.boardToolsExecutorService.cloneBoards(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'clone_boards',
      schema: CloneBoardsScheme,
    },
  )

  const recoverBoards = tool(
    async (data, config) => {
      return await dependencies.services.boardToolsExecutorService.recoverBoards(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'recover_boards',
      schema: RecoverBoardsScheme,
    },
  )

  const moveBoards = tool(
    async (data, config) => {
      return await dependencies.services.boardToolsExecutorService.moveBoards(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'move_boards',
      schema: MoveBoardsScheme,
    },
  )

  return [
    searchBoards,
    createBoards,
    updateBoards,
    deleteArchiveBoards,
    cloneBoards,
    recoverBoards,
    moveBoards,
  ]
}
