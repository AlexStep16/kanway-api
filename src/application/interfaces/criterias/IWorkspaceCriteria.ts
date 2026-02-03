import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IWorkspaceCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]

  isDeleted?: boolean
  name?: string
}
