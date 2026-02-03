import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

export const PasswordRecoveryLinkSchema = z.object({
  email: z.email({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
  }),
})

export type PasswordRecoveryLinkDTO = z.infer<typeof PasswordRecoveryLinkSchema>
