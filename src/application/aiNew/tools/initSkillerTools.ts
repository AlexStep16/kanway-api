import { tool } from '@langchain/core/tools'
import z from 'zod'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'

export function initSkillerTools() {
  const selectSkills = tool(
    (data) => {
      return new SuccessToolResult(data.skills)
    },
    {
      name: 'select_skills',
      schema: z.object({
        skills: z
          .array(z.string())
          .describe('An array of the required main skills the user wants to perform.'),
      }),
    },
  )

  return [selectSkills]
}
