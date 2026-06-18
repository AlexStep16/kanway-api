import { ITextValue } from './ITextValue.js'

export interface IDeleteArchiveEntitiesContent {
  count: number
  isSoftDelete?: boolean
  filters: ITextValue[]
  logId?: string
}
