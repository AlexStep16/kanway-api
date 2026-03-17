import { tool } from '@langchain/core/tools'
import * as z from 'zod'
import { BaseToolAdapter } from './adapters/BaseToolAdapter.ts'
import { Plan, ShowEntitiesToUserSchema } from './schemes/baseSchemes.ts'

export function createExecutorTools(adapter: BaseToolAdapter) {
  const showEntitiesToUser = tool(
    async (data, config) => await adapter.showEntitiesToUser(data, config),
    {
      name: 'showEntitiesToUser',
      description:
        'Shows entities to the user by their IDs and types. Do not describe entities to user after calling this tool. USE it ONLY when user asked to show the entities, eg. "Show me the tasks with IDs 123 and 456". Do not use when do some actions, eg. create, edit, delete, archive, recover, clone.',
      schema: ShowEntitiesToUserSchema,
    },
  )

  const undoOperations = tool(async (data, config) => adapter.undoOperations(data, config), {
    name: 'undoOperations',
    description:
      'Use this tool to undo a set of operations previously performed. Provide the IDs of the operations you wish to revert.',
    schema: z.object({
      operationIds: z.array(z.string()).describe('IDs of the operations to undo'),
    }),
  })

  const getRelevantTools = tool(() => {}, {
    name: 'getRelevantTools',
    description: 'Internal tool for self-analysis. Use it to expand your set of tools.',
    schema: Plan,
  })

  const responseToUser = tool(() => {}, {
    name: 'responseToUser',
    schema: z.object({
      text: z
        .string()
        .describe(
          'Explain the issue to the user. E.g., "I found two categories named \'Done\'. Which one should I use?"',
        ),
      status: z.enum(['clarification', 'error']).describe('The reason for stopping the execution.'),
    }),
  })

  return [showEntitiesToUser, undoOperations, getRelevantTools, responseToUser]
}
