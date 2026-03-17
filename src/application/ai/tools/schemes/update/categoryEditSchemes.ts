import z from 'zod'
import { StringModificationSchema, zodObjectId, zodOrder } from '../baseSchemes.ts'

const editCategoriesNameObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of category IDs to edit.'),
      },
      'Available only category filter fields: ids',
    )
    .strict()
    .describe('Filter categories to edit.'),

  name: StringModificationSchema,
}
export const EditCategoriesNameSchema = z
  .object(
    editCategoriesNameObject,
    'Available only categories name modification fields: ' +
      Object.keys(editCategoriesNameObject).join(', '),
  )
  .strict()

export type EditCategoriesNameDTO = z.infer<typeof EditCategoriesNameSchema>

const moveCategoriesObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of category IDs to move.'),
      },
      'Available only category filter fields: ids',
    )
    .strict()
    .describe('Filter categories to move.'),

  boardId: zodObjectId,
}
export const MoveCategoriesSchema = z
  .object(
    moveCategoriesObject,
    'Available only categories move fields: ' + Object.keys(moveCategoriesObject).join(', '),
  )
  .strict()

export type MoveCategoriesDTO = z.infer<typeof MoveCategoriesSchema>

const editCategoriesOrderObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of category IDs to edit.'),
      },
      'Available only category filter fields: ids',
    )
    .strict()
    .describe('Filter categories to edit.'),

  order: zodOrder.nullable(),
}
export const EditCategoriesOrderSchema = z
  .object(
    editCategoriesOrderObject,
    'Available only categories order modification fields: ' +
      Object.keys(editCategoriesOrderObject).join(', '),
  )
  .strict()

export type EditCategoriesOrderDTO = z.infer<typeof EditCategoriesOrderSchema>
