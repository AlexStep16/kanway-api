import { ChatFireworks } from '@langchain/community/chat_models/fireworks'

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
  const plannerModel = new ChatFireworks({
    model: 'accounts/fireworks/models/glm-4.7',
    temperature: 0,
  })

  const coderModel = new ChatFireworks({
    model: 'accounts/fireworks/models/glm-4.7',
    temperature: 0,
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
