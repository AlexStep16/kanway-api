import { BaseAgentDTO } from './BaseAgentDTO.js'

export interface ApproveToolDTO extends BaseAgentDTO {
  toolId: string
  statusLogId: string
  isConfirmed: boolean
  isRejected: boolean
  threadId: string
}
