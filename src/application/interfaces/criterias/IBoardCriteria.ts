import { IBaseCriteria } from '../IBaseCriteria.ts'

export interface IBoardCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]

  isDeleted?: boolean
  isDeletedExternal?: boolean
  workspaceId?: string
  workspaceIds?: string[]
  name?: string
}
