import { IUser } from '@/domain/entities/IUser.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'

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
