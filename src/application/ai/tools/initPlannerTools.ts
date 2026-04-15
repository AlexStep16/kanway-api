import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/SuccessToolResult.js'
import { ExecutePlanDTOSchema } from '../dtos/ExecutePlanDTO.js'

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
