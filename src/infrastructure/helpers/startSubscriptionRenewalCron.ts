import * as Sentry from '@sentry/node'
import cron from 'node-cron'
import { UserService } from '@/application/services/UserService.js'
import { subscriptionQueue } from '../queues/SubscriptionQueue.js'

export function startSubscriptionRenewalCron(userService: UserService) {
  return cron.schedule('0 0 * * *', async () => {
    const currentDate = new Date()
    const currentDateKey = currentDate.toISOString().slice(0, 10)

    try {
      const dueUsers = await userService.getDueActiveSubscriptions(currentDate)
      const results = await Promise.allSettled(
        dueUsers.map((user) =>
          subscriptionQueue.add(
            'renew-subscription',
            { userId: user.id.toString() },
            {
              jobId: `renew_${user.id}_${currentDateKey}`,
            },
          ),
        ),
      )

      results.forEach((result) => {
        if (result.status === 'rejected') {
          Sentry.captureException(result.reason)
        }
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  })
}
