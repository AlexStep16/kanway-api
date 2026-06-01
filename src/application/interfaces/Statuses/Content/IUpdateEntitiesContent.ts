import { ITextValue } from './ITextValue.js'

export interface IUpdateEntitiesContent {
  ids: string[]
  filters: ITextValue[]
  logId?: string
}
