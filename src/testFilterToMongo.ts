import { Types } from 'mongoose'
import { initializeDependencies } from './infrastructure/di/initializeDependencies.ts'
import connectToDatabase from './infrastructure/db/connectToDatabase.ts'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import dayjs from 'dayjs'

const dependencies = initializeDependencies()

await connectToDatabase()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)

dependencies.services.filterToMongoQueryService
  .prepare(
    {
      ids: [],
      categoryIds: [],
      boardIds: ['69455e207feda92bdfc48c2f'],
      isCompleted: false,
      name: {
        value: 'оплатить счета',
        operator: 'contains',
        isNegated: false,
      },
    },
    'Europe/Moscow',
    Types.ObjectId.createFromHexString('67da84f0a2e3729760781559')
  )
  .then(async (mongoFilter) => {
    const tasks = await dependencies.services.taskService.getByFilter(
      mongoFilter,
      Types.ObjectId.createFromHexString('67da84f0a2e3729760781559'),
      30
    )
    console.log('Tasks:', tasks)
  })
  .catch((error) => {
    console.error('Error generating Mongo query:', error)
  })
