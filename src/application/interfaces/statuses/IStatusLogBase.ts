import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'

export interface IStatusLogBase<TType extends StatusTypesEnum, TContent> {
  id: string
  type: TType
  state: StatusStatesEnum
  content: TContent
}
