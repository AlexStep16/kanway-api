import z from 'zod'
import { StringModificationSchema, zodObjectId, zodOrder } from '../baseSchemes.ts'

const editBoardsNameObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of board IDs to edit.'),
      },
      'Available only board filter fields: ids',
    )
    .strict()
    .describe('Filter boards to edit.'),

  name: StringModificationSchema,
}
export const EditBoardsNameSchema = z
  .object(
    editBoardsNameObject,
    'Available only boards name modification fields: ' +
      Object.keys(editBoardsNameObject).join(', '),
  )
  .strict()

export type EditBoardsNameDTO = z.infer<typeof EditBoardsNameSchema>

const moveBoardsObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of board IDs to move.'),
      },
      'Available only board filter fields: ids',
    )
    .strict()
    .describe('Filter boards to move.'),

  workspaceId: zodObjectId,
}
export const MoveBoardsSchema = z
  .object(
    moveBoardsObject,
    'Available only boards move fields: ' + Object.keys(moveBoardsObject).join(', '),
  )
  .strict()

export type MoveBoardsDTO = z.infer<typeof MoveBoardsSchema>

const FavoriteBoardsObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of board IDs to favorite.'),
      },
      'Available only board filter fields: ids',
    )
    .strict()
    .describe('Filter boards to favorite.'),

  isFavorite: z.boolean(),
}
export const FavoriteBoardsSchema = z
  .object(
    FavoriteBoardsObject,
    'Available only boards favorite fields: ' + Object.keys(FavoriteBoardsObject).join(', '),
  )
  .strict()

export type FavoriteBoardsDTO = z.infer<typeof FavoriteBoardsSchema>

const editBoardsOrderObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of board IDs to edit.'),
      },
      'Available only board filter fields: ids',
    )
    .strict()
    .describe('Filter boards to edit.'),

  order: zodOrder.nullable(),
}
export const EditBoardsOrderSchema = z
  .object(
    editBoardsOrderObject,
    'Available only boards order modification fields: ' +
      Object.keys(editBoardsOrderObject).join(', '),
  )
  .strict()

export type EditBoardsOrderDTO = z.infer<typeof EditBoardsOrderSchema>
