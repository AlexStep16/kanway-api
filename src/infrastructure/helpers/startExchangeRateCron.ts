import * as Sentry from '@sentry/node'
import cron from 'node-cron'
import { updateAndSaveRate } from './exchangeRateStore.js'

export function startExchangeRateCron() {
  // Run every day at 09:00 — CBR publishes rates around 09:00 Moscow time
  updateAndSaveRate().catch((error) => Sentry.captureException(error))

  return cron.schedule('0 9 * * *', async () => {
    try {
      await updateAndSaveRate()
    } catch (error) {
      Sentry.captureException(error)
    }
  })
}
