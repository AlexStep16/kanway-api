import { tool } from '@langchain/core/tools'
import { BoardBaseToolAdapter } from '../adapters/boards/BoardBaseToolAdapter.ts'
import z from 'zod'
import { zodObjectId } from '../schemes/baseSchemes.ts'
import { BoardCreateSchema } from '../schemes/create/boardCreateSchema.ts'

export function createBaseBoardTools(adapter: BoardBaseToolAdapter) {
  const searchRelevantBoards = tool(
    ({ namesToFind }, config) => adapter.searchRelevantBoards({ namesToFind }, config),
    {
      name: 'searchRelevantBoards',
      schema: z.object({
        namesToFind: z.array(z.string()),
      }),
    },
  )

  const createBoards = tool((data, config) => adapter.createBoards(data, config), {
    name: 'createBoards',
    schema: BoardCreateSchema,
  })

  const archiveBoards = tool((args, config) => adapter.archiveBoards(args, config), {
    name: 'archiveBoards',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const cloneBoards = tool((args, config) => adapter.cloneBoards(args, config), {
    name: 'cloneBoards',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const recoverBoards = tool((args, config) => adapter.recoverBoards(args, config), {
    name: 'recoverBoards',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const deleteBoards = tool((args, config) => adapter.deleteBoards(args, config), {
    name: 'deleteBoards',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  return [
    searchRelevantBoards,
    createBoards,
    archiveBoards,
    recoverBoards,
    deleteBoards,
    cloneBoards,
  ]
}
