import { ITextValue } from './ITextValue.js'

export interface IMoveEntitiesContent {
  ids: string[]
  filters: ITextValue[]
  logId?: string
}
