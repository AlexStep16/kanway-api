import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { initializeDependencies } from '@/infrastructure/di/initializeDependencies.js'
import { z } from 'zod'

const { plugins } = initializeDependencies()

export const PasswordRecoverySchema = z.object({
  password: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.PASSWORD_REQUIRED
          : ErrorMessages.INVALID_PASSWORD_FORMAT,
    })
    .min(10, ErrorMessages.PASSWORD_TOO_SHORT_10)
    .max(128, ErrorMessages.PASSWORD_TOO_LONG)
    .superRefine((val, ctx) => {
      const strengthCheck = plugins.zxcvbn.check(val)

      if (strengthCheck.score < 2) {
        const warning = strengthCheck.feedback.warning || 'Пароль слишком простой.'
        const suggestions = strengthCheck.feedback.suggestions.join(' ')
        const errorMessage = `${warning} ${suggestions}`.trim()

        ctx.addIssue({
          code: 'custom',
          input: val,
          message: errorMessage,
        })
      }
    }),
})

export type PasswordRecoveryDTO = z.infer<typeof PasswordRecoverySchema>
