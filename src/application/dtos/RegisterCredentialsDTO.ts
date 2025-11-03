import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const RegisterCredentialsSchema = z.object({
  email: z.email({
    error: (iss) =>
      iss.input === undefined ? ErrorsMessage.EMAIL_REQUIRED : ErrorsMessage.INVALID_EMAIL_FORMAT,
  }),
  password: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.PASSWORD_REQUIRED
          : ErrorsMessage.INVALID_PASSWORD_FORMAT,
    })
    .min(6, ErrorsMessage.PASSWORD_TOO_SHORT),
})

export type RegisterCredentialsDTO = z.infer<typeof RegisterCredentialsSchema>
