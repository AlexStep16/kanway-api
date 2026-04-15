import { IBaseCriteria } from './IBaseCriteria.js'

export interface ITaskCriteria extends IBaseCriteria {
  isDeleted?: boolean
  isDeletedExternal?: boolean
  boardId?: string
  boardIds?: string[]
  workspaceId?: string
  workspaceIds?: string[]
  categoryId?: string
  categoryIds?: string[]
  name?: string
}
