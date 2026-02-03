import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IUserCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]

  email?: string
}
