import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'

export interface IStatusLog {
  id: string
  type: StatusTypesEnum
  state: StatusStatesEnum
  content: any
}
