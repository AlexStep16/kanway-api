import { z } from 'zod'
import { SignupCredentialsSchema } from './SignupCredentialsDTO.js'
import { UserDTOSchema } from './UserDTO.js'

export const SignupServiceCredentialsSchema = SignupCredentialsSchema.extend({
  password: SignupCredentialsSchema.shape.password.optional(),
  username: UserDTOSchema.shape.username,
  avatarUrl: UserDTOSchema.shape.avatarUrl,
  vkUserId: z.string().optional(),
  yandexUserId: z.string().optional(),
})

export type SignupServiceCredentialsDTO = z.infer<typeof SignupServiceCredentialsSchema>
