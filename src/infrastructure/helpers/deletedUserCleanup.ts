import * as Sentry from '@sentry/node'
import connectToDatabase from '../db/connectToDatabase.js'
import { initializeDependencies } from '../di/initializeDependencies.js'
import { deleteAllUserData } from './deleteAllUserData.js'

const dependencies = initializeDependencies()

await connectToDatabase()

async function deletedUserCleanup() {
  const currentDate = new Date()

  try {
    const deletedUsers = await dependencies.services.userService.getDeletedUsers(currentDate)

    for (const user of deletedUsers) {
      await deleteAllUserData(user)
    }
  } catch (error) {
    Sentry.captureException(error)
  }
}

deletedUserCleanup()
