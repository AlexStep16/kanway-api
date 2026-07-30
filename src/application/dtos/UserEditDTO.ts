import { z } from 'zod'
import { UserDTOSchema } from '@dtos/UserDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export const UserEditSchemaDTO = UserDTOSchema.partial()
  .omit({ email: true })
  .extend({
    currentPassword: z.string(ErrorMessages.INVALID_PASSWORD_FORMAT).optional(),
    deletedTime: z.string().nullable().optional(),
  })

export type UserEditDTO = z.infer<typeof UserEditSchemaDTO>
