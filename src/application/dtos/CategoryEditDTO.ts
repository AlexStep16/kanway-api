import { z } from 'zod'
import { CategoryDTOSchema } from '@/application/dtos/CategoryDTO.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CategoryEditDTOSchema = CategoryDTOSchema.partial().extend({
  id: z
    .string(ErrorsMessage.CATEGORY_ID_INVALID)
    .regex(objectIdRegex, ErrorsMessage.CATEGORY_ID_INVALID),
})

export type CategoryEditDTO = z.infer<typeof CategoryEditDTOSchema>
