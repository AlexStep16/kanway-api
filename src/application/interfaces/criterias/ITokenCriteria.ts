import { IBaseCriteria } from './IBaseCriteria.js'

export interface ITokenCriteria extends IBaseCriteria {
  token?: string
  tokens?: string[]

  type?: string
  types?: string[]
}
