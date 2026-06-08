import { z } from 'zod'
import { ColumnDTOSchema } from '@/application/dtos/ColumnDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ColumnEditDTOSchema = ColumnDTOSchema.partial().extend({
  id: z
    .string(ErrorMessages.COLUMN_ID_INVALID)
    .regex(objectIdRegex, ErrorMessages.COLUMN_ID_INVALID),
})

export type ColumnEditDTO = z.infer<typeof ColumnEditDTOSchema>
