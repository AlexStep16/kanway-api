import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const TokenSchemaDTO = z.object({
  token: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TOKEN_REQUIRED : ErrorMessages.INVALID_TOKEN_FORMAT,
  }),
})

export type TokenDTO = z.infer<typeof TokenSchemaDTO>
