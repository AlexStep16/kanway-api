import z from 'zod'
import {
  zodDescription,
  zodDueDate,
  zodDueTime,
  zodName,
  zodObjectId,
  zodOrder,
  zodTags,
  zodTaskColor,
} from '../baseSchemes.ts'

const createTaskFieldsObject = {
  name: zodName.describe('Task name. Should be clear and concise.'),
  categoryName: z.string().optional().describe('Semantic name to search for.'),
  categoryId: zodObjectId.optional().describe('Use only if known or resolved after a prompt.'),
  boardName: z.string().optional().describe('Semantic name to search for.'),
  boardId: zodObjectId.optional().describe('Use only if known or resolved after a prompt.'),
  workspaceName: z.string().optional().describe('Semantic name to search for.'),
  workspaceId: zodObjectId.optional().describe('Use only if known or resolved after a prompt.'),
  description: zodDescription.optional(),
  dueDate: zodDueDate.optional(),
  dueTime: zodDueTime.optional(),
  color: zodTaskColor.optional(),
  order: zodOrder.optional(),
  tags: zodTags.optional(),
  isCompleted: z.boolean().optional(),
}
export const TaskCreateSchema = z
  .object(
    {
      tasks: z.array(
        z.object(
          createTaskFieldsObject,
          'Available only task creation fields: ' + Object.keys(createTaskFieldsObject).join(', '),
        ),
        'Must be an array of tasks to create',
      ),
    },
    'Available only tasks field',
  )
  .strict()
  .describe(
    'If the user does not provide category then create the category with default category name but first try semantic search for some categories.',
  )

export type TaskCreateDTO = z.infer<typeof TaskCreateSchema>
