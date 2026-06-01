import { ITextValue } from './ITextValue.js'

export interface IRecoverEntitiesContent {
  ids: string[]
  filters: ITextValue[]
  logId?: string
}
