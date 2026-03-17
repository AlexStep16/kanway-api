import z from 'zod'
import {
  DateModificationSchema,
  StringModificationSchema,
  TagsModificationSchema,
  TimeModificationSchema,
  zodObjectId,
  zodOrder,
  zodTaskColor,
} from '../baseSchemes.ts'

const editTasksNameObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to edit.'),

  name: StringModificationSchema,
}
export const EditTasksNameSchema = z
  .object(
    editTasksNameObject,
    'Available only tasks name modification fields: ' + Object.keys(editTasksNameObject).join(', '),
  )
  .strict()

export type EditTasksNameDTO = z.infer<typeof EditTasksNameSchema>

const editTasksDescriptionObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to edit.'),

  description: StringModificationSchema.nullable(),
}
export const EditTasksDescriptionSchema = z
  .object(
    editTasksDescriptionObject,
    'Available only tasks description modification fields: ' +
      Object.keys(editTasksDescriptionObject).join(', '),
  )
  .strict()

export type EditTasksDescriptionDTO = z.infer<typeof EditTasksDescriptionSchema>

const editTasksDueDateObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to edit.'),

  dueDate: DateModificationSchema.nullable(),
}
export const EditTasksDueDateSchema = z
  .object(
    editTasksDueDateObject,
    'Available only tasks due date modification fields: ' +
      Object.keys(editTasksDueDateObject).join(', '),
  )
  .strict()

export type EditTasksDueDateDTO = z.infer<typeof EditTasksDueDateSchema>

const editTasksDueTimeObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to edit.'),

  dueTime: TimeModificationSchema.nullable(),
}
export const EditTasksDueTimeSchema = z
  .object(
    editTasksDueTimeObject,
    'Available only tasks due time modification fields: ' +
      Object.keys(editTasksDueTimeObject).join(', '),
  )
  .strict()

export type EditTasksDueTimeDTO = z.infer<typeof EditTasksDueTimeSchema>

const editTasksTagsObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to edit.'),

  tags: TagsModificationSchema.nullable(),
}
export const EditTasksTagsSchema = z
  .object(
    editTasksTagsObject,
    'Available only tasks tags modification fields: ' + Object.keys(editTasksTagsObject).join(', '),
  )
  .strict()

export type EditTasksTagsDTO = z.infer<typeof EditTasksTagsSchema>

const moveTasksObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to move.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to move.'),

  categoryId: zodObjectId,
}
export const MoveTasksSchema = z
  .object(
    moveTasksObject,
    'Available only tasks move fields: ' + Object.keys(moveTasksObject).join(', '),
  )
  .strict()

export type MoveTasksDTO = z.infer<typeof MoveTasksSchema>

const completeTasksObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to complete.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to complete.'),

  isCompleted: z.boolean(),
}
export const CompleteTasksSchema = z
  .object(
    completeTasksObject,
    'Available only tasks complete fields: ' + Object.keys(completeTasksObject).join(', '),
  )
  .strict()

export type CompleteTasksDTO = z.infer<typeof CompleteTasksSchema>

const editTasksColorObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to edit.'),

  update: zodTaskColor.nullable(),
}
export const EditTasksColorSchema = z
  .object(
    editTasksColorObject,
    'Available only tasks color modification fields: ' +
      Object.keys(editTasksColorObject).join(', '),
  )
  .strict()

export type EditTasksColorDTO = z.infer<typeof EditTasksColorSchema>

const editTasksOrderObject = {
  filter: z
    .object(
      {
        ids: z.array(zodObjectId).describe('Array of task IDs to edit.'),
      },
      'Available only task filter fields: ids',
    )
    .strict()
    .describe('Filter tasks to edit.'),

  order: zodOrder,
}
export const EditTasksOrderSchema = z
  .object(
    editTasksOrderObject,
    'Available only tasks order modification fields: ' +
      Object.keys(editTasksOrderObject).join(', '),
  )
  .strict()

export type EditTasksOrderDTO = z.infer<typeof EditTasksOrderSchema>
