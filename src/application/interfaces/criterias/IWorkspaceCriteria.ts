import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IWorkspaceCriteria extends IBaseCriteria {
  isDeleted?: boolean
  name?: string
}
