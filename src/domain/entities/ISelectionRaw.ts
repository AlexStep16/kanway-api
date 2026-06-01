import { Types } from 'mongoose'
import { EntityTypesEnum } from '../enums/EntityTypesEnum.js'
import { ITextValue } from '@/application/interfaces/Statuses/Content/ITextValue.js'

export interface ISelectionRaw {
  _id: Types.ObjectId
  entity_type: EntityTypesEnum
  entity_ids: Types.ObjectId[]
  human_readable_filters: ITextValue[]
  sample: Record<string, any>[]
  count: number
  user_id: Types.ObjectId
}
