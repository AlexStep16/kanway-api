import { ManagersEnum } from '@/enums/ManagersEnum.js'
import { z } from 'zod'

export const CallManagerScheme = z.object({
  manager: z.enum(ManagersEnum).describe('The manager agent to call.'),
  instruction: z.string().describe('Natural language instruction describing the requested action.'),
}).describe(`
  DTO for delegating work to the Manager Agent.
  Do not make parallel tool calls. You must only call this tool once per turn.
`)

export type CallManagerAgentDTO = z.infer<typeof CallManagerScheme>
