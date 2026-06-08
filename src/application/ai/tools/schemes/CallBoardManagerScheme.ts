import { z } from 'zod'

export const CallBoardManagerScheme = z.object({
  instruction: z.string().describe('Natural language instruction describing the requested action.'),
  payload: z
    .record(z.string(), z.unknown())
    .describe(
      'The payload to be sent to the Board Manager Agent. Provide all necessary technical details such as ids, selection_ids, and exact criteria.',
    ),
}).describe(`
  DTO for delegating board-related work to the Board Manager Agent.

  The orchestrator should use this DTO only for high-level intent routing.
  Use instruction to describe the requested action in natural language.
`)

export type CallBoardManagerAgentDTO = z.infer<typeof CallBoardManagerScheme>
