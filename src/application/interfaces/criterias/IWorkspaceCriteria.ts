import { IBaseCriteria } from './IBaseCriteria.js'

export interface IWorkspaceCriteria extends IBaseCriteria {
  isDeleted?: boolean
  name?: string
}
