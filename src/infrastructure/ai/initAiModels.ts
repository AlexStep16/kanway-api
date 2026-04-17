import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { ChatOpenAI } from '@langchain/openai'
import { SocksProxyAgent } from 'socks-proxy-agent'
import nodeFetch from 'node-fetch'

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
  const agent = new SocksProxyAgent('socks5h://127.0.0.1:1080')

  const plannerModel = new ChatOpenAI({
    model: 'gpt-5.4-mini-2026-03-17',
    temperature: 0,
    configuration: {
      fetch: (url, options) => {
        return nodeFetch(
          url as any,
          {
            ...options,
            agent,
          } as any,
        ) as any
      },
    },
  })

  const coderModel = new ChatOpenAI({
    model: 'gpt-5.4-mini-2026-03-17',
    temperature: 0,
    configuration: {
      fetch: (url, options) => {
        return nodeFetch(
          url as any,
          {
            ...options,
            agent,
          } as any,
        ) as any
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
