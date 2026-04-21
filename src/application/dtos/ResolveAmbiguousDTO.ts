import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { BaseAgentDTO } from './BaseAgentDTO.js'

export interface ResolveAmbiguousDTO extends BaseAgentDTO {
  callId: string
  jobId: string
  modelType: ModelsEnum
  ids: string[]
}
