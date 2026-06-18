import { IUser } from '@/domain/entities/IUser.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

export interface Configurable {
  thread_id: string
  jobId?: string
  iterationId: string
  user: IUser
  chatId: string
  activeBoard: {
    id: string
    name: string
  } | null
  activeWorkspace: {
    id: string
    name: string
  }
  modelType: ModelsEnum
  currentDate: string
  columnsList: string
  boardsList: string
  workspacesList: string
  audioCreditsSpent?: number
  tagsList: string
  timezone: string
  userMessage: string

  aiName: string
  aiConfirmationType: AiConfirmationTypeEnum
  defaultColumnName: string
  defaultBoardName: string
  statusMessageId: string
}
