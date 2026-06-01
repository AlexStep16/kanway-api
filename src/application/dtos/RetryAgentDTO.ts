import { BaseAgentDTO } from './BaseAgentDTO.js'

export interface RetryAgentDTO extends BaseAgentDTO {
  threadId: string
}
