import connectToDatabase from './infrastructure/db/connectToDatabase.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import dayjs from 'dayjs'
import { initializeDependencies } from './infrastructure/di/initializeDependencies.js'
import { Types } from 'mongoose'

const dependencies = initializeDependencies()

await connectToDatabase()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)

async function test() {
  const tasks = await dependencies.services.vectorSearchService.similaritySearchTasks(
    ['Налоги'],
    new Types.ObjectId('69e735c8bea70b6721b5afe0'),
    3,
    new Types.ObjectId('6a3bc97af9e86620404ffe64'),
  )

  console.log(tasks)
}

test()
