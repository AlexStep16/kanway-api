import { z } from 'zod'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { ColumnEditDTOSchema } from './ColumnEditDTO.js'

export const ColumnEditManyDTOSchema = z.array(ColumnEditDTOSchema, {
  error: ErrorMessages.COLUMNS_BULK_UPDATE_INVALID,
})

export type ColumnEditManyDTO = z.infer<typeof ColumnEditManyDTOSchema>
