import * as Sentry from '@sentry/node'
import { UserService } from '@/application/services/UserService.js'
import { initializeDependencies } from '../di/initializeDependencies.js'
import { deleteAllUserData } from './deleteAllUserData.js'
import connectToDatabase from '../db/connectToDatabase.js'

const dependencies = initializeDependencies()

await connectToDatabase()

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
