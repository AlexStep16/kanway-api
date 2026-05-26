import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { IStatusLog } from './IStatusLog.js'
import { StatusTools } from '@/application/types/StatusTools.js'

export interface IStatusLogTool extends IStatusLog {
  type: StatusTypesEnum.TOOL
  content: StatusTools
}
