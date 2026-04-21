import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

export interface RetryAgentDTO {
  chatId: string
  threadId: string
  jobId: string
  boardId: string
  workspaceId: string
  modelType: ModelsEnum
  timezone: string
}
