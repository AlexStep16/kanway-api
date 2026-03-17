import { tool } from '@langchain/core/tools'
import * as z from 'zod'

export function createPlannerTools() {
  const finishResponse = tool(() => {}, {
    name: 'finishResponse',
    schema: z.object({
      text: z.string().describe('The message or clarifying question to send back to the user.'),
      status: z
        .enum(['clarification', 'chat', 'error'])
        .describe('The reason for stopping the execution.'),
    }),
  })

  const executePlan = tool(() => {}, {
    name: 'executePlan',
    schema: z.object({
      steps: z
        .array(z.string())
        .describe(
          'Sequential steps for the Executor to perform. E.g., ["1. Find category X", "2. Create task Y in category X"].',
        ),
      relevantInstructions: z
        .array(z.string())
        .describe(
          'An array of EXACT skill names from the AVAILABLE SKILLS list needed to execute this plan.',
        ),
      reasoning: z
        .string()
        .describe('Briefly explain why you chose this plan and these instructions.'),
    }),
  })

  return [finishResponse, executePlan]
}
