import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'
import z from 'zod'
import { ExecutePlanDTOSchema } from '../dtos/ExecutePlanDTO.ts'

export function initReplannerTools() {
  const updatePlan = tool(
    (data) => {
      return new SuccessToolResult(data)
    },
    {
      name: 'update_plan',
      schema: ExecutePlanDTOSchema,
    },
  )

  const continueTool = tool(
    () => {
      return new SuccessToolResult(null)
    },
    {
      name: 'continue',
      schema: z.object({}).describe('Continue with the current plan without changes.'),
    },
  )

  return [updatePlan, continueTool]
}
