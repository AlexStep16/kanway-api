import { calculateCredits } from './application/ai/helpers/calculateCredits.js'
import { ModelsEnum } from './domain/enums/ModelsEnum.js'
import connectToDatabase from './infrastructure/db/connectToDatabase.js'

await connectToDatabase()

function test() {
  console.log(
    calculateCredits(
      { input_tokens: 300000, output_tokens: 10000, input_token_details: { cache_read: 20000 } },
      ModelsEnum.GPT_5_6_LUNA,
    ),
  )
}

test()
