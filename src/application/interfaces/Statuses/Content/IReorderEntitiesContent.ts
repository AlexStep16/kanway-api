import { ITextValue } from './ITextValue.js'

export interface IReorderEntitiesContent {
  count: number
  filters: ITextValue[]
  logId?: string
}
