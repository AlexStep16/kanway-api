import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'
import { SettingDTOSchema } from '@dtos/SettingDTO.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const SettingEditDTOSchema = SettingDTOSchema.partial().extend({
  id: z
    .string(ErrorsMessage.SETTING_ID_INVALID)
    .regex(objectIdRegex, ErrorsMessage.SETTING_ID_INVALID),
})

export type SettingEditDTO = z.infer<typeof SettingEditDTOSchema>
