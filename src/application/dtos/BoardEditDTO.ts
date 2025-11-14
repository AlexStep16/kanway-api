import { z } from 'zod'
import { BoardDTOSchema } from '@/application/dtos/BoardDTO.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardEditDTOSchema = BoardDTOSchema.partial().extend({
  id: z.string(ErrorsMessage.BOARD_ID_INVALID).regex(objectIdRegex, ErrorsMessage.BOARD_ID_INVALID),
})

export type BoardEditDTO = z.infer<typeof BoardEditDTOSchema>
