import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const CheckEmailExistsSchemaDTO = z.object({
  email: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.EMAIL_REQUIRED : ErrorMessages.INVALID_EMAIL_FORMAT,
  }),
})

export type CheckEmailExistsDTO = z.infer<typeof CheckEmailExistsSchemaDTO>
