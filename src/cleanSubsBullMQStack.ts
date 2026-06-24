import { subscriptionQueue } from './infrastructure/queues/SubscriptionQueue.js'

async function clearOldDelayedJobs() {
  try {
    await subscriptionQueue.drain(true)
  } catch (error) {
    console.error('[Queue Cleanup] Ошибка при очистке очереди:', error)
  }
}

// Вызовите эту функцию ОДИН раз при старте
await clearOldDelayedJobs()
