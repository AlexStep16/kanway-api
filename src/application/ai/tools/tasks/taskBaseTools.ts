import { tool } from '@langchain/core/tools'
import { TaskBaseToolAdapter } from '../adapters/tasks/TaskBaseToolAdapter.ts'
import z from 'zod'
import { zodObjectId } from '../schemes/baseSchemes.ts'
import { TaskCreateSchema } from '../schemes/create/taskCreateSchema.ts'

export function createBaseTaskTools(adapter: TaskBaseToolAdapter) {
  const searchRelevantTasks = tool(
    ({ namesToFind }, config) => adapter.searchRelevantTasks({ namesToFind }, config),
    {
      name: 'searchRelevantTasks',
      schema: z.object({
        namesToFind: z.array(z.string()),
      }),
    },
  )

  const createTasks = tool((data, config) => adapter.createTasks(data, config), {
    name: 'createTasks',
    schema: TaskCreateSchema,
  })

  const archiveTasks = tool((args, config) => adapter.archiveTasks(args, config), {
    name: 'archiveTasks',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const cloneTasks = tool((args, config) => adapter.cloneTasks(args, config), {
    name: 'cloneTasks',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const recoverTasks = tool((args, config) => adapter.recoverTasks(args, config), {
    name: 'recoverTasks',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  const deleteTasks = tool((args, config) => adapter.deleteTasks(args, config), {
    name: 'deleteTasks',
    schema: z.object({
      ids: z.array(zodObjectId),
    }),
  })

  return [searchRelevantTasks, createTasks, archiveTasks, recoverTasks, deleteTasks, cloneTasks]
}
