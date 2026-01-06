import connectToDatabase from '@infrastructure/db/connectToDatabase.ts'
import { initializeDependencies } from './infrastructure/di/initializeDependencies.ts'
import { Types } from 'mongoose'

await connectToDatabase()

const dependencies = initializeDependencies()

async function test() {
  await dependencies.services.baseService.similaritySearchBoards(
    'работа',
    Types.ObjectId.createFromHexString('67da84f0a2e3729760781559'),
    30
  )
}

test()
