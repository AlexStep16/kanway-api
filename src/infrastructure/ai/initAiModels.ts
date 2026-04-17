import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { ChatOpenAI } from '@langchain/openai'
import { ProxyAgent } from 'undici'
//import { ProxyAgent } from 'undici'

/* Example of thinking model
  const coderModel = new ChatFireworks({
    model: 'accounts/fireworks/models/qwen3-vl-30b-a3b-thinking',
    reasoning: {
      effort: 'low',
    },
    maxTokens: 10000,
    maxCompletionTokens: 10000,
  })*/

export function initAiModels() {
  const plannerModel = new ChatOpenAI({
    model: 'gpt-5.4-mini-2026-03-17',
    temperature: 0,
    configuration: {
      fetchOptions: {
        dispatcher: new ProxyAgent('http://127.0.0.1:1080'),
      },
    },
  })

  const coderModel = new ChatOpenAI({
    model: 'gpt-5.4-mini-2026-03-17',
    temperature: 0,
    configuration: {
      fetchOptions: {
        dispatcher: new ProxyAgent('http://127.0.0.1:1080'),
      },
    },
  })

  const summarizerModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-20b',
    temperature: 0,
  })

  const chatNameModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-20b',
  })

  return {
    plannerModel,
    coderModel,
    summarizerModel,
    chatNameModel,
  }
}
