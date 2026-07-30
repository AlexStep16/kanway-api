import { ClientSession } from 'mongoose'
import { initializeDependencies } from '../di/initializeDependencies.js'
import { IUser } from '@/domain/entities/IUser.js'

const dependencies = initializeDependencies()

export async function deleteAllUserData(
  user: IUser,
  session?: ClientSession,
): Promise<Promise<any>[]> {
  const promises = []

  const chats = await dependencies.services.chatService.getByCriteria({}, user.id, session)
  const threadIds = chats.map((chat) => chat.threadId)

  promises.push(
    dependencies.services.boardService.delete({}, user, session),
    dependencies.services.workspaceService.delete({}, user, session),
    dependencies.services.columnService.delete({}, user, session),
    dependencies.services.taskService.delete({}, user, session),
    dependencies.services.operationLogService.delete({}, user, session),
    dependencies.services.chatMessageService.delete({}, user, session),
    dependencies.services.chatService.delete({}, user, session),
    dependencies.services.operationLogService.delete({}, user, session),
    dependencies.repositories.checkpointRepository.deleteMany(
      {
        threadIds: threadIds,
      },
      user.id,
      session,
    ),
    dependencies.repositories.checkpointWriteRepository.deleteMany(
      {
        threadIds: threadIds,
      },
      user.id,
      session,
    ),
    dependencies.repositories.selectionRepository.deleteMany({}, user.id, session),
    dependencies.services.paymentService.delete({}, user, session),
    dependencies.services.paymentMethodService.delete({}, user, session),
    dependencies.services.settingService.delete({}, user, session),
    dependencies.services.userService.delete({}, user, session),
  )

  return promises
}
