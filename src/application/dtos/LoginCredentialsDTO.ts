import { ErrorMessages } from '@/enums/ErrorMessages.ts'
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
    .min(6, ErrorMessages.PASSWORD_TOO_SHORT),
})

export type LoginCredentialsDTO = z.infer<typeof LoginCredentialsSchema>
