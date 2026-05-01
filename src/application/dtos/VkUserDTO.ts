import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const VkUserSchema = z.object({
  email: z.email({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
  }),
  clientId: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.VK_CLIENT_ID_REQUIRED
        : ErrorMessages.INVALID_VK_CLIENT_ID_FORMAT,
  }),
  avatarUrl: z.string().optional(),
  username: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.USERNAME_REQUIRED : ErrorMessages.USERNAME_INVALID,
  }),
  timezone: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TIMEZONE_REQUIRED : ErrorMessages.INVALID_TIMEZONE,
  }),
})

export type VkUserDTO = z.infer<typeof VkUserSchema>
