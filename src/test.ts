import connectToDatabase from '@infrastructure/db/connectToDatabase.ts'
import { initializeDependencies } from './infrastructure/di/initializeDependencies.ts'
import { Types } from 'mongoose'

await connectToDatabase()

const dependencies = initializeDependencies()

async function test() {
  /*console.log(
    await dependencies.services.baseService.similaritySearchCategories(
      'спорт',
      Types.ObjectId.createFromHexString('67da84f0a2e3729760781559'),
      2
    )
  )*/

  const filter = await dependencies.services.filterToMongoQueryService.prepare(
    {
      name: {
        equal: 'спорт',
      },
    },
    'Europe/Moscow',
    Types.ObjectId.createFromHexString('67da84f0a2e3729760781559')
  )

  const categories = await dependencies.services.categoryService.getByFilter(
    filter,
    Types.ObjectId.createFromHexString('67da84f0a2e3729760781559'),
    30
  )

  console.log(categories)
}

test()
