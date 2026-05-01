import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const YandexUserSchema = z.object({
  email: z.email({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
  }),
  clientId: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.YANDEX_CLIENT_ID_REQUIRED
        : ErrorMessages.INVALID_YANDEX_CLIENT_ID_FORMAT,
  }),
  username: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.USERNAME_REQUIRED : ErrorMessages.USERNAME_INVALID,
  }),
  avatarUrl: z.string().optional(),
  timezone: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TIMEZONE_REQUIRED : ErrorMessages.INVALID_TIMEZONE,
  }),
})

export type YandexUserDTO = z.infer<typeof YandexUserSchema>
