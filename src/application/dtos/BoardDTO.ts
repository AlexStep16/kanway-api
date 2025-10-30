import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { Types } from 'mongoose'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardDTOSchema = z.object({
  name: z
    .string({
      required_error: ErrorsMessage.BOARD_NAME_REQUIRED,
      invalid_type_error: ErrorsMessage.BOARD_NAME_INVALID,
    })
    .min(1, ErrorsMessage.BOARD_NAME_REQUIRED),
  workspace_id: z
    .string({
      required_error: ErrorsMessage.BOARD_ID_REQUIRED,
      invalid_type_error: ErrorsMessage.BOARD_ID_INVALID,
    })
    .regex(objectIdRegex)
    .transform((id: string) => {
      return new Types.ObjectId(id)
    }),
  order: z
    .union([z.string(), z.number()], {
      invalid_type_error: ErrorsMessage.BOARD_ORDER_TYPE_INVALID,
    })
    .optional(),
})

export type BoardDTO = z.infer<typeof BoardDTOSchema>
