import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'
import { initializeDependencies } from '@/infrastructure/di/initializeDependencies.js'

const { services } = initializeDependencies()

const checkEmailUnique = async (email: string) => {
  try {
    return await services.authService.checkEmailUnique(email)
  } catch {
    return false
  }
}

export const FinishSignupCredentialsSchema = z.object({
  email: z
    .email({
      error: (iss) =>
        iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
    })
    .refine(checkEmailUnique, {
      message: ErrorMessages.EMAIL_ALREADY_EXISTS,
    }),
  timezone: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TIMEZONE_REQUIRED : ErrorMessages.INVALID_TIMEZONE,
  }),
})

export type FinishSignupCredentialsDTO = z.infer<typeof FinishSignupCredentialsSchema>
