import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'
import { z } from 'zod'

export const UserDTOSchema = z.object({
  username: z
    .string()
    .min(1, ErrorsMessage.USERNAME_TOO_SHORT)
    .max(50, ErrorsMessage.USERNAME_TOO_LONG)
    .optional(),
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
    .min(6, ErrorsMessage.PASSWORD_TOO_SHORT)
    .max(100, ErrorsMessage.PASSWORD_TOO_LONG),
  avatarColor: z.enum(BASE_COLORS, {
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.USER_COLOR_REQUIRED
        : 'Неверное значение для цвета. Допустимы: ' + BASE_COLORS.join(', '),
  }),
  timezone: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorsMessage.TIMEZONE_REQUIRED : ErrorsMessage.INVALID_TIMEZONE,
  }),
  paymentMethodId: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.PAYMENT_METHOD_ID_REQUIRED
        : ErrorsMessage.INVALID_PAYMENT_METHOD_ID,
  }),
})

export type UserDTO = z.infer<typeof UserDTOSchema>
