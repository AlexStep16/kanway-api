import { Queue } from 'bullmq'

export const subscriptionQueue = new Queue('subscription-renewal', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 1000 * 60 * 60 * 24,
    },
  },
})
