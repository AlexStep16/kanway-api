import { z } from 'zod'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { CategoryEditDTOSchema } from './CategoryEditDTO.ts'

export const CategoryEditManyDTOSchema = z.array(CategoryEditDTOSchema, {
  error: ErrorsMessage.CATEGORIES_BULK_UPDATE_INVALID,
})

export type CategoryEditManyDTO = z.infer<typeof CategoryEditManyDTOSchema>
