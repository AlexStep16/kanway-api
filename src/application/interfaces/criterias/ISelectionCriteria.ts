import { IBaseCriteria } from './IBaseCriteria.js'

export interface ISelectionCriteria extends IBaseCriteria {
  entityType?: string
  entityTypes?: string[]
}
