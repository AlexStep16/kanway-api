import { IUser } from '@/domain/entities/IUser.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'

export interface Configurable {
  thread_id: string
  user: IUser
  chatId: string
  activeBoardId: string
  activeWorkspaceId: string
  currentDate: string
  timezone: string

  aiName: string
  aiConfirmationType: AiConfirmationTypeEnum
  defaultCategoryName: string
  defaultBoardName: string
}
