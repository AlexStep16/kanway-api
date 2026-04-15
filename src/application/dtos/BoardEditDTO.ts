import { z } from 'zod'
import { BoardDTOSchema } from '@/application/dtos/BoardDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardEditDTOSchema = BoardDTOSchema.partial().extend({
  id: z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex, ErrorMessages.BOARD_ID_INVALID),
})

export type BoardEditDTO = z.infer<typeof BoardEditDTOSchema>
