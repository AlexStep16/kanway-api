import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const CategoryDTOSchema = z.object({
  name: z
    .string({
      required_error: ErrorsMessage.CATEGORY_NAME_REQUIRED,
      invalid_type_error: ErrorsMessage.CATEGORY_NAME_INVALID,
    })
    .min(1, ErrorsMessage.CATEGORY_NAME_REQUIRED),
  boardId: z.string({
    required_error: ErrorsMessage.BOARD_ID_REQUIRED,
    invalid_type_error: ErrorsMessage.BOARD_ID_INVALID,
  }),
  order: z
    .union([z.string(), z.number()], {
      invalid_type_error: ErrorsMessage.CATEGORY_ORDER_TYPE_INVALID,
    })
    .optional(),
})

export type CategoryDTO = z.infer<typeof CategoryDTOSchema>
