import z from 'zod'

export const LookupToolsetScheme = z.object({
  tool_names: z.array(z.string()).optional().describe('Load tools by tool names.'),
}).describe(`
  The lookup_toolset is a special tool that allows the agent to dynamically load other tools during its execution.
  By providing an array of tool names in the "tool_names" field, the agent can request the loading of specific tools that it may need to accomplish its tasks.
`)

export type LookupToolsetDTO = z.infer<typeof LookupToolsetScheme>
