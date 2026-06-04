import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { SearchCategoriesScheme } from './schemes/CategoryManager/SearchCategoriesScheme.js'
import { UpdateCategoriesScheme } from './schemes/CategoryManager/UpdateCategoriesScheme.js'
import { DeleteArchiveCategoriesScheme } from './schemes/CategoryManager/DeleteArchiveCategoriesScheme.js'
import { CloneCategoriesScheme } from './schemes/CategoryManager/CloneCategoriesScheme.js'
import { RecoverCategoriesScheme } from './schemes/CategoryManager/RecoverCategoriesScheme.js'
import { MoveCategoriesScheme } from './schemes/CategoryManager/MoveCategoriesScheme.js'

export function initCategoryManagerTools(
  dependencies: AgentDependencies,
  runnableConfig: RunnableConfig,
) {
  const searchCategories = tool(
    async (data, config) => {
      return await dependencies.services.categoryToolsExecutorService.searchCategories(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'search_categories',
      schema: SearchCategoriesScheme,
    },
  )

  const updateCategories = tool(
    async (data, config) => {
      return await dependencies.services.categoryToolsExecutorService.updateCategories(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'update_categories',
      schema: UpdateCategoriesScheme,
    },
  )

  const deleteArchiveCategories = tool(
    async (data, config) => {
      return await dependencies.services.categoryToolsExecutorService.deleteArchiveCategories(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'delete_archive_categories',
      schema: DeleteArchiveCategoriesScheme,
    },
  )

  const cloneCategories = tool(
    async (data, config) => {
      return await dependencies.services.categoryToolsExecutorService.cloneCategories(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'clone_categories',
      schema: CloneCategoriesScheme,
    },
  )

  const recoverCategories = tool(
    async (data, config) => {
      return await dependencies.services.categoryToolsExecutorService.recoverCategories(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'recover_categories',
      schema: RecoverCategoriesScheme,
    },
  )

  const moveCategories = tool(
    async (data, config) => {
      return await dependencies.services.categoryToolsExecutorService.moveCategories(
        data,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'move_categories',
      schema: MoveCategoriesScheme,
    },
  )

  return [
    searchCategories,
    updateCategories,
    deleteArchiveCategories,
    cloneCategories,
    recoverCategories,
    moveCategories,
  ]
}
