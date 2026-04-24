import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { BASE_COLORS } from '@constants/BASE_COLORS.js'
import { z } from 'zod'

export const UserDTOSchema = z.object({
  username: z
    .string()
    .min(1, ErrorMessages.USERNAME_TOO_SHORT)
    .max(50, ErrorMessages.USERNAME_TOO_LONG)
    .optional(),
  email: z.email({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
  }),
  yandexClientId: z.string().optional(),
  password: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.PASSWORD_REQUIRED
          : ErrorMessages.INVALID_PASSWORD_FORMAT,
    })
    .min(10, ErrorMessages.PASSWORD_TOO_SHORT_10)
    .max(100, ErrorMessages.PASSWORD_TOO_LONG),
  avatarColor: z.enum(BASE_COLORS, {
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.USER_COLOR_REQUIRED
        : 'Неверное значение для цвета. Допустимы: ' + BASE_COLORS.join(', '),
  }),
  timezone: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TIMEZONE_REQUIRED : ErrorMessages.INVALID_TIMEZONE,
  }),
  audioTokensUsed: z.number().optional(),
  isConfirmed: z.boolean().optional(),
  paymentMethodId: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.PAYMENT_METHOD_ID_REQUIRED
        : ErrorMessages.INVALID_PAYMENT_METHOD_ID,
  }),
  credits: z.number().optional(),
  paidCredits: z.number().optional(),
  subscriptionId: z
    .enum(SubscriptionPlanEnum, {
      error: () => ({ message: ErrorMessages.SUBSCRIPTION_PLAN_INVALID }),
    })
    .optional(),
  isSubscriptionActive: z.boolean().optional(),
  subscriptionUntil: z.date().nullable().optional(),
  paymentRetriesCount: z.number().optional(),
  pendingChangePlan: z
    .enum(SubscriptionPlanEnum, {
      error: () => ({ message: ErrorMessages.SUBSCRIPTION_PLAN_INVALID }),
    })
    .nullable()
    .optional(),
})

export type UserDTO = z.infer<typeof UserDTOSchema>
