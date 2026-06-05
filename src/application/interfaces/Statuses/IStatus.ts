import { StatusLog } from '@/application/types/StatusLog.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'

export interface IStatus {
  statusText: string
  currentAgent: AgentsEnum
  state: StatusStatesEnum
  error?: string
  logs: StatusLog[]
}
