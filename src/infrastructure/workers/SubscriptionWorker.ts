import { Worker, Job } from 'bullmq'
import * as Sentry from '@sentry/node'
import { initializeDependencies } from '../di/initializeDependencies.js'
import connectToDatabase from '../db/connectToDatabase.js'
import { AppError } from '@/domain/errors/AppError.js'
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'

const proxyAgent = new EnvHttpProxyAgent()
if (process.env.NODE_ENV === 'production') setGlobalDispatcher(proxyAgent)

const dependencies = initializeDependencies()

Sentry.init({
  dsn: 'https://2aa4717bdc17380896b4b44e49d09363@o4510595293249536.ingest.de.sentry.io/4510595296264272',
  enableLogs: true,
  sendDefaultPii: true,
})

await connectToDatabase()

export const worker = new Worker(
  'subscription-renewal',
  async (job: Job) => {
    const { userId } = job.data

    await dependencies.services.paymentService.autoChargeSubscription(userId)
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  },
)

worker.on('failed', (_, err) => {
  if (!(err instanceof AppError) || err.statusCode === 500) Sentry.captureException(err)
})
