import * as Sentry from '@sentry/node'
import cron from 'node-cron'
import { UserService } from '@/application/services/UserService.js'
import { deleteAllUserData } from './deleteAllUserData.js'

export function startDeletedUserCleanupCron(userService: UserService) {
  return cron.schedule('0 0 * * *', async () => {
    const currentDate = new Date()

    try {
      const deletedUsers = await userService.getDeletedUsers(currentDate)

      for (const user of deletedUsers) {
        await deleteAllUserData(user)
      }
    } catch (error) {
      Sentry.captureException(error)
    }
  })
}
