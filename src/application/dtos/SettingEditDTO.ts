import { z } from 'zod'
import { SettingDTOSchema } from '@dtos/SettingDTO.js'

export const SettingEditDTOSchema = SettingDTOSchema.partial()

export type SettingEditDTO = z.infer<typeof SettingEditDTOSchema>
