import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { ChatVertexAI } from '@langchain/google-vertexai'

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
  const plannerModel = new ChatVertexAI({
    model: 'gemini-3-flash-preview',
  }) /* new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-120b',
  })*/

  const coderModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-120b',
  })

  const replannerModel = new ChatVertexAI({
    model: 'gemini-3-flash-preview',
  }) /* new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-120b',
  })*/

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
    replannerModel,
    summarizerModel,
    chatNameModel,
  }
}
