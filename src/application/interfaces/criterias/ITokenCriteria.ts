import { IBaseCriteria } from './IBaseCriteria.ts'

export interface ITokenCriteria extends IBaseCriteria {
  token?: string
  tokens?: string[]

  type?: string
  types?: string[]
}
