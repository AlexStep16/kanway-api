import { IBaseCriteria } from './IBaseCriteria.js'

export interface IBoardCriteria extends IBaseCriteria {
  isDeleted?: boolean
  isDeletedExternal?: boolean
  workspaceId?: string
  workspaceIds?: string[]
  name?: string
}
