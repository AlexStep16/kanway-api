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

async function test() {
  const user = await dependencies.services.userService.getById('67da84f0a2e3729760781559')
  const oldTasks = await dependencies.services.taskService.getByCriteria({})
  const updatedTasks = oldTasks.map((task) => {
    return {
      id: task.id.toString(),
      color: null,
    }
  })

  await dependencies.services.taskService.editMany(updatedTasks, user!)
}

test()
