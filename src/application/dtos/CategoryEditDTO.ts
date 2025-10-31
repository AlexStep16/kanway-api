import { z } from 'zod'
import { CategoryDTOSchema } from '@/application/dtos/CategoryDTO.ts'

export const CategoryEditDTOSchema = CategoryDTOSchema.partial()

export type CategoryEditDTO = z.infer<typeof CategoryEditDTOSchema>
