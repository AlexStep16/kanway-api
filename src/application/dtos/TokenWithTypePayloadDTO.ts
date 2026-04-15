import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const TokenWithTypePayloadSchemaDTO = z.object({
  token: z.string({
    error: (iss) =>
      iss.input === undefined ? ErrorMessages.TOKEN_REQUIRED : ErrorMessages.INVALID_TOKEN_FORMAT,
  }),
  type: z.enum(TokenTypesEnum, {
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.TOKEN_TYPE_REQUIRED
        : 'Неверное значение для типа токена. Допустимы: ' +
          Object.values(TokenTypesEnum).join(', '),
  }),
})

export type TokenWithTypePayloadDTO = z.infer<typeof TokenWithTypePayloadSchemaDTO>
