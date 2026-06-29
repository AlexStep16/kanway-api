import connectToDatabase from './infrastructure/db/connectToDatabase.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import dayjs from 'dayjs'
import { initializeDependencies } from './infrastructure/di/initializeDependencies.js'

const dependencies = initializeDependencies()

await connectToDatabase()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)

async function test() {
  const dueSubscription = await dependencies.services.userService.getDueActiveSubscriptions(
    new Date(),
  )

  console.log(dueSubscription)
}

test()
