import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IUserCriteria extends IBaseCriteria {
  email?: string
}
