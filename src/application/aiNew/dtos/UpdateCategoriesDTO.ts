import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'
import { CreateCategoryDTOSchema } from './CreateCategoriesDTO.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const UpdateCategoryDTOSchema = CreateCategoryDTOSchema.partial()
  .extend({
    _id: z
      .string(ErrorMessages.CATEGORY_ID_INVALID)
      .regex(objectIdRegex, ErrorMessages.CATEGORY_ID_INVALID),
  })
  .strict()

export const UpdateCategoriesDTOSchema = z.object({
  updates: UpdateCategoryDTOSchema.array(),
})

export type UpdateCategoriesDTO = z.infer<typeof UpdateCategoriesDTOSchema>
