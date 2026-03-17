import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'
import { CreateBoardDTOSchema } from './CreateBoardsDTO.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const UpdateBoardDTOSchema = CreateBoardDTOSchema.partial()
  .extend({
    _id: z
      .string(ErrorMessages.BOARD_ID_INVALID)
      .regex(objectIdRegex, ErrorMessages.BOARD_ID_INVALID),
  })
  .strict()

export const UpdateBoardsDTOSchema = z.object({
  updates: UpdateBoardDTOSchema.array(),
})

export type UpdateBoardsDTO = z.infer<typeof UpdateBoardsDTOSchema>
