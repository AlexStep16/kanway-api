import { ITextValue } from './ITextValue.js'

export interface IUpdateEntitiesContent {
  count: number
  filters: ITextValue[]
  logId?: string
}
