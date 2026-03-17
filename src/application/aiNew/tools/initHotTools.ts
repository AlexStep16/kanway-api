import { tool } from '@langchain/core/tools'
import z from 'zod'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'

export function initHotTools() {
  const finishResponse = tool(
    (data) => {
      return new SuccessToolResult(null, data)
    },
    {
      name: 'finish_response',
      schema: z.object({
        text: z.string().describe('The message or clarifying question to send back to the user.'),
        status: z
          .enum(['clarification', 'chat', 'error'])
          .describe('The reason for stopping the execution.'),
      }),
    },
  )

  return [finishResponse]
}
