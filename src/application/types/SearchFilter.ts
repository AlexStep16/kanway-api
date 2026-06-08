import { SearchColumnsDTO } from '../ai/tools/schemes/ColumnManager/SearchColumnsScheme.js'
import { SearchBoardsDTO } from '../ai/tools/schemes/BoardManager/SearchBoardsScheme.js'
import { SearchTasksDTO } from '../ai/tools/schemes/TaskManager/SearchTasksScheme.js'
import { SearchWorkspacesDTO } from '../ai/tools/schemes/WorkspaceManager/SearchWorkspacesScheme.js'

export type SearchFilter =
  | SearchTasksDTO['filters'][number]
  | SearchColumnsDTO['filters'][number]
  | SearchBoardsDTO['filters'][number]
  | SearchWorkspacesDTO['filters'][number]
export type SearchFilterOperator = Omit<SearchFilter, 'field'>
