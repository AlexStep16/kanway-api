import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const FinishSignupCredentialsSchema = z.object({
  email: z.email({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
  }),
  timezone: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TIMEZONE_REQUIRED : ErrorMessages.INVALID_TIMEZONE,
  }),
})

export type FinishSignupCredentialsDTO = z.infer<typeof FinishSignupCredentialsSchema>
