import { z } from 'zod'

export const CallWorkspaceManagerScheme = z.object({
  instruction: z.string().describe('Natural language instruction describing the requested action.'),
}).describe(`
  DTO for delegating workspace-related work to the Workspace Manager Agent.

  The orchestrator should use this DTO only for high-level intent routing.
  Use instruction to describe the requested action in natural language.
`)

export type CallWorkspaceManagerAgentDTO = z.infer<typeof CallWorkspaceManagerScheme>
