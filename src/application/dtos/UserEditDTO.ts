import { z } from 'zod'
import { UserDTOSchema } from '@dtos/UserDTO.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'

export const UserEditSchemaDTO = UserDTOSchema.partial()
  .omit({ email: true })
  .extend({
    currentPassword: z.string(ErrorMessages.INVALID_PASSWORD_FORMAT).optional(),
  })

export type UserEditDTO = z.infer<typeof UserEditSchemaDTO>
