import { ITextValue } from './ITextValue.js'

export interface IDeleteArchiveEntitiesContent {
  ids: string[]
  isSoftDelete?: boolean
  filters: ITextValue[]
  logId?: string
}
