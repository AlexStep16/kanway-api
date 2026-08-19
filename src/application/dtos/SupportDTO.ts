import { ThemesEnum } from '@/domain/enums/ThemesEnum.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const SupportSchemaDTO = z.object({
  theme: z.enum(ThemesEnum, ErrorMessages.SUPPORT_THEME_INVALID),
  details: z
    .string(ErrorMessages.SUPPORT_DETAILS_INVALID)
    .min(1, ErrorMessages.SUPPORT_DETAILS_REQUIRED)
    .max(4000, ErrorMessages.SUPPORT_DETAILS_TOO_LONG),
  email: z.email(ErrorMessages.INVALID_SUPPORT_EMAIL_FORMAT),
  name: z.string(ErrorMessages.SUPPORT_NAME_REQUIRED).min(1, ErrorMessages.SUPPORT_NAME_REQUIRED),
})

export type SupportDTO = z.infer<typeof SupportSchemaDTO>
