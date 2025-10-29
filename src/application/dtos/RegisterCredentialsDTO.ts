import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const RegisterCredentialsSchema = z.object({
  email: z
    .string({
      required_error: ErrorsMessage.EMAIL_REQUIRED,
      invalid_type_error: ErrorsMessage.INVALID_EMAIL_FORMAT,
    })
    .email(ErrorsMessage.INVALID_EMAIL_FORMAT),
  password: z
    .string({
      required_error: ErrorsMessage.PASSWORD_REQUIRED,
      invalid_type_error: ErrorsMessage.INVALID_PASSWORD_FORMAT,
    })
    .min(6, ErrorsMessage.PASSWORD_TOO_SHORT),
})

export type RegisterCredentialsDTO = z.infer<typeof RegisterCredentialsSchema>
