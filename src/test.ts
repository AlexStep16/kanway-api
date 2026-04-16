import connectToDatabase from './infrastructure/db/connectToDatabase.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import duration from 'dayjs/plugin/duration.js'
import dayjs from 'dayjs'
import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { ChatPromptTemplate } from '@langchain/core/prompts'

await connectToDatabase()

dayjs.locale('ru')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)

async function test() {
  const chatNameModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-20b',
  })

  const prompt = ChatPromptTemplate.fromMessages([['user', 'Привет, как тебя зовут?']])

  const chain = prompt.pipe(chatNameModel)

  const result = await chain.invoke({})
  console.log(result)
}

test()
