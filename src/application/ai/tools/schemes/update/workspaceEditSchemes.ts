import z from 'zod'
import {
  StringModificationSchema,
  zodObjectId,
  zodOrder,
  zodWorkspaceColor,
} from '../baseSchemes.ts'

const editWorkspacesNameObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of workspace IDs to edit.'),
      },
      'Available only workspace filter fields: ids',
    )
    .strict()
    .describe('Filter workspaces to edit.'),

  name: StringModificationSchema,
}
export const EditWorkspacesNameSchema = z
  .object(
    editWorkspacesNameObject,
    'Available only workspaces name modification fields: ' +
      Object.keys(editWorkspacesNameObject).join(', '),
  )
  .strict()

export type EditWorkspacesNameDTO = z.infer<typeof EditWorkspacesNameSchema>

const moveWorkspacesObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of workspace IDs to move.'),
      },
      'Available only workspace filter fields: ids',
    )
    .strict()
    .describe('Filter workspaces to move.'),

  workspaceId: zodObjectId,
}
export const MoveWorkspacesSchema = z
  .object(
    moveWorkspacesObject,
    'Available only workspaces move fields: ' + Object.keys(moveWorkspacesObject).join(', '),
  )
  .strict()

export type MoveWorkspacesDTO = z.infer<typeof MoveWorkspacesSchema>

const favoriteWorkspacesObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of workspace IDs to favorite.'),
      },
      'Available only workspace filter fields: ids',
    )
    .strict()
    .describe('Filter workspaces to favorite.'),

  isFavorite: z.boolean(),
}
export const FavoriteWorkspacesSchema = z
  .object(
    favoriteWorkspacesObject,
    'Available only workspaces favorite fields: ' +
      Object.keys(favoriteWorkspacesObject).join(', '),
  )
  .strict()

export type FavoriteWorkspacesDTO = z.infer<typeof FavoriteWorkspacesSchema>

const editWorkspacesColorObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of workspace IDs to edit.'),
      },
      'Available only workspace filter fields: ids',
    )
    .strict()
    .describe('Filter workspaces to edit.'),

  color: zodWorkspaceColor,
}
export const EditWorkspacesColorSchema = z
  .object(
    editWorkspacesColorObject,
    'Available only workspaces color modification fields: ' +
      Object.keys(editWorkspacesColorObject).join(', '),
  )
  .strict()

export type EditWorkspacesColorDTO = z.infer<typeof EditWorkspacesColorSchema>

const editWorkspacesOrderObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of workspace IDs to edit.'),
      },
      'Available only workspace filter fields: ids',
    )
    .strict()
    .describe('Filter workspaces to edit.'),

  order: zodOrder.nullable(),
}
export const EditWorkspacesOrderSchema = z
  .object(
    editWorkspacesOrderObject,
    'Available only workspaces order modification fields: ' +
      Object.keys(editWorkspacesOrderObject).join(', '),
  )
  .strict()

export type EditWorkspacesOrderDTO = z.infer<typeof EditWorkspacesOrderSchema>
