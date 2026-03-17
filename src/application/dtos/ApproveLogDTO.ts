import { BaseAgentDTO } from './BaseAgentDTO.ts'

export interface ApproveLogDTO extends BaseAgentDTO {
  id: string
  selectedIds: string[]
  isConfirmed: boolean
  threadId: string
}
