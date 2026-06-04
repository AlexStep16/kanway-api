import z from 'zod'

export const CloneBoardsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  board_ids: z.array(z.string()).optional().describe('Target board ids.'),
}).describe(`
  Clone boards.
  Pass selection_id or board_ids.
`)

export type CloneBoardsDTO = z.infer<typeof CloneBoardsScheme>
