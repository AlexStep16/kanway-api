import { z } from 'zod'
import { SettingDTOSchema } from '@dtos/SettingDTO.ts'

export const SettingEditDTOSchema = SettingDTOSchema.partial()

export type SettingEditDTO = z.infer<typeof SettingEditDTOSchema>
