import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const SettingDTOSchema = z.object({
  aiName: z
    .string()
    .min(1, ErrorsMessage.SETTING_AI_NAME_TOO_SHORT)
    .max(50, ErrorsMessage.SETTING_AI_NAME_TOO_LONG),
  aiConfirmationType: z.union([z.literal(0), z.literal(1), z.literal(2)], {
    error: (iss) =>
      iss.input === undefined
        ? { message: ErrorsMessage.SETTING_AI_CONFIRMATION_TYPE_REQUIRED }
        : { message: 'Неверное значение для типа подтверждения ИИ. Допустимы: 0, 1, 2' },
  }),
  aiDefaultCategory: z
    .string()
    .max(100, ErrorsMessage.SETTING_AI_DEFAULT_CATEGORY_TOO_LONG)
    .optional(),
  aiDefaultBoard: z.string().max(100, ErrorsMessage.SETTING_AI_DEFAULT_BOARD_TOO_LONG).optional(),
})

export type SettingDTO = z.infer<typeof SettingDTOSchema>
