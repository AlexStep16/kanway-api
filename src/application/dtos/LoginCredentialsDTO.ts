import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const LoginCredentialsSchema = z.object({
  email: z.email({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
  }),
  password: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.PASSWORD_REQUIRED
          : ErrorMessages.INVALID_PASSWORD_FORMAT,
    })
    .min(1, ErrorMessages.PASSWORD_TOO_SHORT_1),
})

export type LoginCredentialsDTO = z.infer<typeof LoginCredentialsSchema>
