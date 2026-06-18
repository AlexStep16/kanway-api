import { ITextValue } from './ITextValue.js'

export interface ICloneEntitiesContent {
  count: number
  filters: ITextValue[]
  logId?: string
}
