import z from 'zod'

export const RecoverBoardsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  board_ids: z.array(z.string()).optional().describe('Target board ids.'),
}).describe(`
  Recover boards.
  Pass selection_id or board_ids.
`)

export type RecoverBoardsDTO = z.infer<typeof RecoverBoardsScheme>
