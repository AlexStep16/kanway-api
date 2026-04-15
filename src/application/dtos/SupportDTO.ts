import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const SupportSchemaDTO = z.object({
  theme: z.string(ErrorMessages.SUPPORT_THEME_INVALID).min(1, ErrorMessages.SUPPORT_THEME_REQUIRED),
  details: z
    .string(ErrorMessages.SUPPORT_DETAILS_INVALID)
    .min(1, ErrorMessages.SUPPORT_DETAILS_REQUIRED),
  email: z.email(ErrorMessages.INVALID_SUPPORT_EMAIL_FORMAT),
  name: z.string(ErrorMessages.SUPPORT_NAME_REQUIRED).min(1, ErrorMessages.SUPPORT_NAME_REQUIRED),
})

export type SupportDTO = z.infer<typeof SupportSchemaDTO>
