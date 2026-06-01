import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

export interface BaseAgentDTO {
  chatId: string
  jobId: string
  boardId?: string
  modelType: ModelsEnum
  workspaceId: string
  timezone: string
}
