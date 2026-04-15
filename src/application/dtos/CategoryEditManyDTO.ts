import { z } from 'zod'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { CategoryEditDTOSchema } from './CategoryEditDTO.js'

export const CategoryEditManyDTOSchema = z.array(CategoryEditDTOSchema, {
  error: ErrorMessages.CATEGORIES_BULK_UPDATE_INVALID,
})

export type CategoryEditManyDTO = z.infer<typeof CategoryEditManyDTOSchema>
