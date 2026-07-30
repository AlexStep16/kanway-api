import * as Sentry from '@sentry/node'
import cron from 'node-cron'
import { UserService } from '@/application/services/UserService.js'
import { deleteAllUserData } from './deleteAllUserData.js'

export function userDeletingCron(userService: UserService) {
  return cron.schedule('0 0 * * *', async () => {
    const currentDate = new Date()

    try {
      const deletedUsers = await userService.getDeletedUsers(currentDate)
      deletedUsers.forEach((user) => {
        deleteAllUserData(user)
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  })
}
