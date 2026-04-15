import { BaseAgentDTO } from './BaseAgentDTO.js'

export interface ResolveAmbiguousDTO extends BaseAgentDTO {
  callId: string
  jobId: string
  ids: string[]
}
