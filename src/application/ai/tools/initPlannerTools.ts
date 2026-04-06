import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'
import { ExecutePlanDTOSchema } from '../dtos/ExecutePlanDTO.ts'

export function initPlannerTools() {
  const executePlan = tool(
    (data) => {
      return new SuccessToolResult(data)
    },
    {
      name: 'execute_plan',
      schema: ExecutePlanDTOSchema,
    },
  )

  return [executePlan]
}
