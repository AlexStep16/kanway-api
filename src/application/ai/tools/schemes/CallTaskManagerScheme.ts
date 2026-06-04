import { z } from 'zod'

export const CallTaskManagerScheme = z.object({
  instruction: z.string().describe('Natural language instruction describing the requested action.'),
}).describe(`
  DTO for delegating task-related work to the Task Manager Agent.

  The orchestrator should use this DTO only for high-level intent routing.
  Use instruction to describe the requested action in natural language.
`)

export type CallTaskManagerAgentDTO = z.infer<typeof CallTaskManagerScheme>
