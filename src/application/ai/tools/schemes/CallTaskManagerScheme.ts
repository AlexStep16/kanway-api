import { z } from 'zod'

export const CallTaskManagerScheme = z.object({
  instruction: z.string().describe('Natural language instruction describing the requested action.'),
  selection_id: z
    .string()
    .optional()
    .describe('Optional reference to a user selection that the instruction should be applied to.'),
}).describe(`
  DTO for delegating task-related work to the Task Manager Agent.

  The orchestrator should use this DTO only for high-level intent routing.
  Use instruction to describe the requested action in natural language.
  Use selection_id to point to an existing selection.
`)

export type CallTaskManagerAgentDTO = z.infer<typeof CallTaskManagerScheme>
