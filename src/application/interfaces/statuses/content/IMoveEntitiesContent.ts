import { ITextValue } from './ITextValue.js'

export interface IMoveEntitiesContent {
  count: number
  filters: ITextValue[]
  logId?: string
}
