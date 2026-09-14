import * as Sentry from '@sentry/node'
import { UserService } from '@/application/services/UserService.js'
import { initializeDependencies } from '../di/initializeDependencies.js'
import { deleteAllUserData } from './deleteAllUserData.js'

const dependencies = initializeDependencies()

async function deletedUserCleanup(userService: UserService) {
  const currentDate = new Date()

  try {
    const deletedUsers = await userService.getDeletedUsers(currentDate)

    for (const user of deletedUsers) {
      await deleteAllUserData(user)
    }
  } catch (error) {
    Sentry.captureException(error)
  }
}

deletedUserCleanup(dependencies.services.userService)
