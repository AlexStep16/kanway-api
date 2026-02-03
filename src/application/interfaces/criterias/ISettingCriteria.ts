import { IBaseCriteria } from './IBaseCriteria.ts'

export interface ISettingCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]

  userId?: string
}
