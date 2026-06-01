import { EntityTypesEnum } from '@/domain/enums/EntityTypesEnum.js'
import { Types } from 'mongoose'
import { ITextValue } from '../interfaces/Statuses/Content/ITextValue.js'

export interface SelectionDTO {
  entityType: EntityTypesEnum
  entityIds: Types.ObjectId[]
  humanReadableFilters: ITextValue[]
  sample: Record<string, any>[]
  count: number
}
