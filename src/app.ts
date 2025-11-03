import dotenv from 'dotenv'
import connectToDatabase from '@db/connectToDatabase.ts'
import express from 'express'
import { attachRoutes } from '@routes/index.ts'
import { startOpenAIProxy } from '@/infrastructure/ws/startOpenAIProxy.ts'
import { globalErrorHandler } from '@middlewares/globalErrorHandler.ts'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)

dotenv.config()

await connectToDatabase()

const app = express()

attachRoutes(app)

app.listen(3333, () => {
  console.log('Application listening on port 3333!')
})

startOpenAIProxy(8080)

app.use(globalErrorHandler)
