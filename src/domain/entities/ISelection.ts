import { Types } from 'mongoose'
import { EntityTypesEnum } from '../enums/EntityTypesEnum.js'
import { ITextValue } from '@/application/interfaces/Statuses/Content/ITextValue.js'

export interface ISelection {
  id: Types.ObjectId
  entityType: EntityTypesEnum
  entityIds: Types.ObjectId[]
  humanReadableFilters: ITextValue[]
  sample: Record<string, any>[]
  count: number
  userId: Types.ObjectId
}
