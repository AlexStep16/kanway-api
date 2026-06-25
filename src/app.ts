import dotenv from 'dotenv'
import connectToDatabase from '@db/connectToDatabase.js'
import express from 'express'
import { createApiRouter } from '@/createApiRouter.js'
import { globalErrorHandler } from '@middlewares/globalErrorHandler.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import * as Sentry from '@sentry/node'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import path from 'path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { Redis } from 'ioredis'
import { generalLimiter } from './limiters.js'
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'
import { initializeDependencies } from './infrastructure/di/initializeDependencies.js'
import { Server } from 'socket.io'
import http from 'http'
import { setupOpenAISocket } from './infrastructure/ws/setupOpenAISocket.js'
import * as cookie from 'cookie'
import jwt from 'jsonwebtoken'
import { AppError } from './domain/errors/AppError.js'
import { ErrorMessages } from './enums/ErrorMessages.js'
import { startSubscriptionRenewalCron } from '@/infrastructure/helpers/startSubscriptionRenewalCron.js'

const KEY = process.env.JWT_KEY || 'FF123ABC-456D-789E-F012-3456789ABCDF'

const dependencies = initializeDependencies()

const proxyAgent = new EnvHttpProxyAgent()
if (process.env.NODE_ENV === 'production') setGlobalDispatcher(proxyAgent)

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
})

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

Sentry.init({
  dsn: 'https://523ce3ec8a363ff541dc44105a630e28@o4510595293249536.ingest.de.sentry.io/4511252866793552',
  enableLogs: true,
  sendDefaultPii: true,
})

redis.on('error', (err) => {
  Sentry.captureException(err)
})

dotenv.config()

await connectToDatabase()

const app = express()

const frontUrl = process.env.FRONT_URL || 'https://kanway.ru'
const frontUrlWww = process.env.FRONT_URL_WWW || 'https://www.kanway.ru'

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use(
  cors({
    origin: [frontUrl, frontUrlWww, 'http://localhost:3001'],
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

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: [frontUrl, frontUrlWww, 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

io.use(async (socket, next) => {
  const cookieString = socket.handshake.headers.cookie

  if (!cookieString) {
    return next(new AppError(ErrorMessages.USER_NOT_AUTHORIZED, 401))
  }

  // 2. Парсим куки
  const cookies = cookie.parse(cookieString)
  const token = cookies['token']

  if (!token) {
    return next(new AppError(ErrorMessages.USER_NOT_AUTHORIZED, 401))
  }

  try {
    const decoded = jwt.verify(token, KEY) as { user_id: string }

    const user = await dependencies.services.userService.getById(decoded.user_id)

    if (!user) {
      return next(new AppError(ErrorMessages.USER_NOT_AUTHORIZED, 401))
    }

    if (user.credits <= 0 && user.paidCredits <= 0) {
      return next(new AppError(ErrorMessages.CREDITS_LOW, 402))
    }

    socket.data.userId = decoded.user_id

    next()
  } catch {
    next(new AppError(ErrorMessages.USER_NOT_AUTHORIZED, 401))
  }
})

setupOpenAISocket(io)

app.use(globalErrorHandler)

server.listen(3333, '0.0.0.0')

dependencies.services.subscriptionService.initSubscriptions()
startSubscriptionRenewalCron(dependencies.services.userService)
