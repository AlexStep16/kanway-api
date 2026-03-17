import { tool } from '@langchain/core/tools'
import { WorkspaceBaseToolAdapter } from '../adapters/workspaces/WorkspaceBaseToolAdapter.ts'
import z from 'zod'
import { zodObjectId } from '../schemes/baseSchemes.ts'
import { WorkspaceCreateSchema } from '../schemes/create/workspaceCreateSchema.ts'

export function createBaseWorkspaceTools(adapter: WorkspaceBaseToolAdapter) {
  const searchRelevantWorkspaces = tool(
    ({ namesToFind }, config) => adapter.searchRelevantWorkspaces({ namesToFind }, config),
    {
      name: 'searchRelevantWorkspaces',
      schema: z.object({
        namesToFind: z.array(z.string()),
      }),
    },
  )

  const createWorkspaces = tool((data, config) => adapter.createWorkspaces(data, config), {
    name: 'createWorkspaces',
    schema: WorkspaceCreateSchema,
  })

  const archiveWorkspaces = tool((args, config) => adapter.archiveWorkspaces(args, config), {
    name: 'archiveWorkspaces',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const cloneWorkspaces = tool((args, config) => adapter.cloneWorkspaces(args, config), {
    name: 'cloneWorkspaces',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const recoverWorkspaces = tool((args, config) => adapter.recoverWorkspaces(args, config), {
    name: 'recoverWorkspaces',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const deleteWorkspaces = tool((args, config) => adapter.deleteWorkspaces(args, config), {
    name: 'deleteWorkspaces',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  return [
    searchRelevantWorkspaces,
    createWorkspaces,
    archiveWorkspaces,
    recoverWorkspaces,
    deleteWorkspaces,
    cloneWorkspaces,
  ]
}
