import { BaseAgentDTO } from './BaseAgentDTO.js'

export interface ApproveLogDTO extends BaseAgentDTO {
  id: string
  selectedIds: string[]
  isConfirmed: boolean
  threadId: string
}
