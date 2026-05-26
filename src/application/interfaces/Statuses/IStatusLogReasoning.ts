import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { IStatusLog } from './IStatusLog.js'

export interface IStatusLogReasoning extends IStatusLog {
  type: StatusTypesEnum.REASONING
  content: {
    reasoning: string
  }
}
