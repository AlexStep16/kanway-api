import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CategoryMoveDTOSchema = z.object({
  id: z.string(ErrorMessages.CATEGORY_ID_INVALID).regex(objectIdRegex),
  beforeId: z
    .string(ErrorMessages.BEFORE_CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterId: z
    .string(ErrorMessages.AFTER_CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  newBoardId: z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex).nullable().optional(),
})

export type CategoryMoveDTO = z.infer<typeof CategoryMoveDTOSchema>
