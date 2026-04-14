import { BaseAgentDTO } from './BaseAgentDTO.ts'

export interface ResolveAmbiguousDTO extends BaseAgentDTO {
  callId: string
  jobId: string
  ids: string[]
}
