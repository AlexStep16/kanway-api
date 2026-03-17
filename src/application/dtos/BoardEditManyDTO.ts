import { z } from 'zod'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { BoardEditDTOSchema } from './BoardEditDTO.ts'

export const BoardEditManyDTOSchema = z.array(BoardEditDTOSchema, {
  error: ErrorMessages.BOARDS_BULK_UPDATE_INVALID,
})

export type BoardEditManyDTO = z.infer<typeof BoardEditManyDTOSchema>
