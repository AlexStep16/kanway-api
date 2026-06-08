import { ITextValue } from './ITextValue.js'

export interface IRecoverEntitiesContent {
  count: number
  filters: ITextValue[]
  logId?: string
}
