import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CategoryMoveManyDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.CATEGORY_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.CATEGORIES_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.CATEGORIES_BULK_UPDATE_INVALID),
  beforeCategoryId: z
    .string(ErrorMessages.BEFORE_CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterCategoryId: z
    .string(ErrorMessages.AFTER_CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  newBoardId: z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex).nullable().optional(),
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
})

export type CategoryMoveManyDTO = z.infer<typeof CategoryMoveManyDTOSchema>
