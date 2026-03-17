import { tool } from '@langchain/core/tools'
import { SearchEntitiesSchema } from './schemes/search/searchEntitiesSchema.ts'
import { BaseToolAdapter } from './adapters/BaseToolAdapter.ts'

export function createBaseTools(adapter: BaseToolAdapter) {
  const searchEntities = tool(async (data, config) => await adapter.searchEntities(data, config), {
    name: 'searchEntities',
    description: 'Searches for entities based on the provided criteria.',
    schema: SearchEntitiesSchema,
  })

  return [searchEntities]
}
