import dotenv from 'dotenv'
import connectToDatabase from '@db/connectToDatabase.ts'
import express from 'express'
import { createApiRouter } from '@/createApiRouter.ts'
import { startOpenAIProxy } from '@/infrastructure/ws/startOpenAIProxy.ts'
import { globalErrorHandler } from '@middlewares/globalErrorHandler.ts'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
//import { initSubscriptions } from './initSubscriptions.ts'
import * as Sentry from '@sentry/node'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import path from 'path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { Redis } from 'ioredis'
import { generalLimiter } from './limiters.ts'

const redis = new Redis()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

Sentry.init({
  dsn: 'https://2aa4717bdc17380896b4b44e49d09363@o4510595293249536.ingest.de.sentry.io/4510595296264272',
  enableLogs: true,
  sendDefaultPii: true,
})

redis.on('error', (err) => {
  Sentry.captureException(err)
})

dotenv.config()

await connectToDatabase()

const app = express()

const frontUrl = process.env.FRONT_URL || 'https://kanbar.ru'
const frontUrlWithoutProtocol = frontUrl.split('https://')[1]

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use(
  cors({
    origin: [frontUrl, 'https://www.' + frontUrlWithoutProtocol, 'http://localhost:3001'],
    credentials: true,
  }),
)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }))
app.use(cookieParser())

const apiRouter = createApiRouter()

app.use(generalLimiter) // Apply the rate limiter to all API routes

app.set('trust proxy', 1) // Enable if behind a proxy (e.g., Heroku, Nginx)

app.use('/api', apiRouter)

app.listen(3333, '0.0.0.0')

startOpenAIProxy(8080)

app.use(globalErrorHandler)

//initSubscriptions() //mock
