import { SearchCategoriesDTO } from '../ai/tools/schemes/CategoryManager/SearchCategoriesScheme.js'
import { SearchBoardsDTO } from '../ai/tools/schemes/BoardManager/SearchBoardsScheme.js'
import { SearchTasksDTO } from '../ai/tools/schemes/TaskManager/SearchTasksScheme.js'
import { SearchWorkspacesDTO } from '../ai/tools/schemes/WorkspaceManager/SearchWorkspacesScheme.js'

export type SearchFilter =
  | SearchTasksDTO['filters'][number]
  | SearchCategoriesDTO['filters'][number]
  | SearchBoardsDTO['filters'][number]
  | SearchWorkspacesDTO['filters'][number]
export type SearchFilterOperator = Omit<SearchFilter, 'field'>
