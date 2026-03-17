import { tool } from '@langchain/core/tools'
import z from 'zod'
import { zodObjectId } from '../schemes/baseSchemes.ts'
import { CategoryBaseToolAdapter } from '../adapters/categories/CategoryBaseToolAdapter.ts'
import { CategoryCreateSchema } from '../schemes/create/categoryCreateSchema.ts'

export function createBaseCategoryTools(adapter: CategoryBaseToolAdapter) {
  const searchRelevantCategories = tool(
    ({ namesToFind }, config) => adapter.searchRelevantCategories({ namesToFind }, config),
    {
      name: 'searchRelevantCategories',
      schema: z.object({
        namesToFind: z.array(z.string()),
      }),
    },
  )

  const createCategories = tool((data, config) => adapter.createCategories(data, config), {
    name: 'createCategories',
    schema: CategoryCreateSchema,
  })

  const archiveCategories = tool((args, config) => adapter.archiveCategories(args, config), {
    name: 'archiveCategories',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const cloneCategories = tool((args, config) => adapter.cloneCategories(args, config), {
    name: 'cloneCategories',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const recoverCategories = tool((args, config) => adapter.recoverCategories(args, config), {
    name: 'recoverCategories',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const deleteCategories = tool((args, config) => adapter.deleteCategories(args, config), {
    name: 'deleteCategories',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  return [
    searchRelevantCategories,
    createCategories,
    archiveCategories,
    recoverCategories,
    deleteCategories,
    cloneCategories,
  ]
}
