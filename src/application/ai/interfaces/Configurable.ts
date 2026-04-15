import { IUser } from '@/domain/entities/IUser.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'

export interface Configurable {
  thread_id: string
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
  currentDate: string
  categoriesList: string
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
