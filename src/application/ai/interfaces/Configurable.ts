import { IUser } from '@/domain/entities/IUser.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

export interface Configurable {
  thread_id: string
  jobId?: string
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
  categoriesList: string
  chargedAudioTokens?: number
  tagsList: string
  timezone: string
  userMessage: string
  isChatNameNeeded?: boolean

  aiName: string
  aiConfirmationType: AiConfirmationTypeEnum
  defaultCategoryName: string
  defaultBoardName: string
  stepMessageId: string
}
