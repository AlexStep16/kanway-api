import { IBaseCriteria } from './IBaseCriteria.js'

export interface IColumnCriteria extends IBaseCriteria {
  isDeleted?: boolean
  isDeletedExternal?: boolean
  workspaceId?: string
  workspaceIds?: string[]
  boardId?: string
  boardIds?: string[]
  name?: string
}
