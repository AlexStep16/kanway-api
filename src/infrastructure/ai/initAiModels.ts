import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { ChatOpenAI } from '@langchain/openai'

export function initAiModels() {
  const agentModel = new ChatOpenAI({
    model: 'gpt-5.1-codex-max',
  })

  const synthesizerModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-120b',
  })

  const summarizerModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-120b',
    temperature: 0,
  })

  const chatNameModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-120b',
  })

  return {
    agentModel,
    synthesizerModel,
    summarizerModel,
    chatNameModel,
  }
}
