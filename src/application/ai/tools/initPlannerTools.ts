import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'
import { ExecutePlanDTOSchema } from '../dtos/ExecutePlanDTO.ts'
import z from 'zod'

export function initPlannerTools() {
  const executePlan = tool(
    (data) => {
      return new SuccessToolResult(data.plan)
    },
    {
      name: 'execute_plan',
      schema: ExecutePlanDTOSchema,
    },
  )

  const responseToUser = tool(
    (data) => {
      return new SuccessToolResult(null, data)
    },
    {
      name: 'response_to_user',
      schema: z.object({
        message: z.string().describe('The message to send back to the user.'),
      }),
    },
  )

  return [executePlan, responseToUser]
}
