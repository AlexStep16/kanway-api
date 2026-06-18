import { tool } from '@langchain/core/tools'
import { LookupToolsetScheme } from './schemes/ColumnManager/LookupToolsetScheme.js'

export function initManagerTools() {
  const lookupToolset = tool((data) => data, {
    name: 'lookup_toolset',
    schema: LookupToolsetScheme,
  })

  return [lookupToolset]
}
