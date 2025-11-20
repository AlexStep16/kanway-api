import { z } from 'zod'
import { UserDTOSchema } from '@dtos/UserDTO.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'

export const UserEditSchemaDTO = UserDTOSchema.partial()
  .omit({ email: true })
  .extend({
    oldPassword: z.string(ErrorsMessage.INVALID_PASSWORD_FORMAT).optional(),
  })

export type UserEditDTO = z.infer<typeof UserEditSchemaDTO>
