import dotenv from 'dotenv'
import connectToDatabase from '@db/connectToDatabase.ts'
import express from 'express'
import { attachRoutes } from '@routes/index.ts'
import { startOpenAIProxy } from '@/infrastructure/ws/startOpenAIProxy.ts'
import { globalErrorHandler } from '@middlewares/globalErrorHandler.ts'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { initSubscriptions } from './initSubscriptions.ts'
import { initializeTools } from './infrastructure/ai/initializeTools.ts'
import * as Sentry from '@sentry/node'
import { initializeAgentInstructions } from '@infrastructure/ai/initializeAgentInstructions.ts'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

Sentry.init({
  dsn: 'https://2aa4717bdc17380896b4b44e49d09363@o4510595293249536.ingest.de.sentry.io/4510595296264272',

  // Send structured logs to Sentry
  enableLogs: true,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
})

dotenv.config()

await connectToDatabase()

const app = express()

attachRoutes(app)

app.listen(3333, () => {
  console.log('Application listening on port 3333!')
})

startOpenAIProxy(8080)

app.use(globalErrorHandler)

initSubscriptions() //mock
initializeTools()
initializeAgentInstructions()
