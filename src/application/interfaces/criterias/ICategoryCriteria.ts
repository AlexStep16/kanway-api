import { IBaseCriteria } from './IBaseCriteria.ts'

export interface ICategoryCriteria extends IBaseCriteria {
  isDeleted?: boolean
  isDeletedExternal?: boolean
  workspaceId?: string
  workspaceIds?: string[]
  boardId?: string
  boardIds?: string[]
  name?: string
}
