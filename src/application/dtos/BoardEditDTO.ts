import { z } from 'zod'
import { BoardDTOSchema } from '@/application/dtos/BoardDTO.ts'

export const BoardEditDTOSchema = BoardDTOSchema.partial()

export type BoardEditDTO = z.infer<typeof BoardEditDTOSchema>
