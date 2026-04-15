import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const PasswordRecoverySchema = z.object({
  token: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TOKEN_REQUIRED : ErrorMessages.INVALID_TOKEN_FORMAT,
  }),
  password: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.PASSWORD_REQUIRED
          : ErrorMessages.INVALID_PASSWORD_FORMAT,
    })
    .min(10, ErrorMessages.PASSWORD_TOO_SHORT_10),
})

export type PasswordRecoveryDTO = z.infer<typeof PasswordRecoverySchema>
