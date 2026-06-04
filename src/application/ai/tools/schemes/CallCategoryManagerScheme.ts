import { z } from 'zod'

export const CallCategoryManagerScheme = z.object({
  instruction: z.string().describe('Natural language instruction describing the requested action.'),
}).describe(`
  DTO for delegating category-related work to the Category Manager Agent.

  The orchestrator should use this DTO only for high-level intent routing.
  Use instruction to describe the requested action in natural language.
`)

export type CallCategoryManagerAgentDTO = z.infer<typeof CallCategoryManagerScheme>
