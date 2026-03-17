import z from 'zod'
import { operators } from '../baseSchemes.ts'

const fields = z.enum([
  'id',
  'categoryId',
  'boardId',
  'workspaceId',
  'isFavorite',
  'tasksCount',
  'categoriesCount',
  'boardsCount',
  'isCompleted',
  'isArchived',
  'name',
  'description',
  'dueDate',
  'dueTime',
  'tags',
  'color',
  'order',
])

const searchEntitiesObject = {
  field: fields,
  operator: operators,
  value: z.any(),
}

export const SearchEntitiesSchema = z.object({
  filters: z.array(
    z
      .object(
        searchEntitiesObject,
        'Available only search fields: ' + Object.keys(searchEntitiesObject).join(', '),
      )
      .strict(),
  ),
  entity_type: z.enum(['task', 'category', 'board', 'workspace']),
})

export type SearchEntitiesDTO = z.infer<typeof SearchEntitiesSchema>
