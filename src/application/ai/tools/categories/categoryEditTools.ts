import { tool } from '@langchain/core/tools'
import { CategoryEditToolAdapter } from '../adapters/categories/CategoryEditToolAdapter.ts'
import {
  EditCategoriesNameSchema,
  EditCategoriesOrderSchema,
  MoveCategoriesSchema,
} from '../schemes/update/categoryEditSchemes.ts'

export function createEditCategoryTools(adapter: CategoryEditToolAdapter) {
  const updateCategoriesName = tool((args, config) => adapter.updateCategoriesName(args, config), {
    name: 'updateCategoriesName',
    schema: EditCategoriesNameSchema,
  })

  const updateCategoriesOrder = tool(
    (args, config) => adapter.updateCategoriesOrder(args, config),
    {
      name: 'updateCategoriesOrder',
      schema: EditCategoriesOrderSchema,
    },
  )

  const moveCategories = tool((args, config) => adapter.moveCategories(args, config), {
    name: 'moveCategories',
    schema: MoveCategoriesSchema,
  })

  return [updateCategoriesName, updateCategoriesOrder, moveCategories]
}
