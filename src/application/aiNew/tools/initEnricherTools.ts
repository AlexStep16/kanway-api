import { tool } from '@langchain/core/tools'
import z from 'zod'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'

export function initEnricherTools() {
  const resolveQuery = tool(
    (data) => {
      return new SuccessToolResult(data.query)
    },
    {
      name: 'resolve_query',
      schema: z.object({
        query: z.string().describe('A concise summary of the information provided by the user.'),
      }),
    },
  )

  return [resolveQuery]
}
