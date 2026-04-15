import { z } from 'zod'
import { CategoryDTOSchema } from '@/application/dtos/CategoryDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CategoryEditDTOSchema = CategoryDTOSchema.partial().extend({
  id: z
    .string(ErrorMessages.CATEGORY_ID_INVALID)
    .regex(objectIdRegex, ErrorMessages.CATEGORY_ID_INVALID),
})

export type CategoryEditDTO = z.infer<typeof CategoryEditDTOSchema>
