import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { IStatusLogBase } from '../interfaces/statuses/IStatusLogBase.js'
import { StatusTools } from './StatusTools.js'

export type StatusLog =
  | IStatusLogBase<StatusTypesEnum.REASONING, { reasoning: string }>
  | IStatusLogBase<StatusTypesEnum.TOOL, StatusTools>
