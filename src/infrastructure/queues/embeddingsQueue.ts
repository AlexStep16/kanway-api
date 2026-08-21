import { Queue } from 'bullmq'

export const embeddingsQueue = new Queue('embeddings-generation', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    removeOnComplete: {
      count: 100,
      age: 60 * 60 * 24,
    },
    removeOnFail: {
      count: 1000,
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
})
