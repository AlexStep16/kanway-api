import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { ChatOpenAI } from '@langchain/openai'

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
  const PLANNER = new ChatOpenAI({
    model: 'gpt-5.4-mini-2026-03-17',
    temperature: 0,
  })

  const CODER = new ChatOpenAI({
    model: 'gpt-5.4-mini-2026-03-17',
    temperature: 0,
  })

  const PLANNER_PRO = new ChatOpenAI({
    model: 'gpt-5.4',
    temperature: 0,
  })

  const CODER_PRO = new ChatOpenAI({
    model: 'gpt-5.4',
    temperature: 0,
  })

  const SUMMARIZER = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-20b',
    temperature: 0,
  })

  const CHAT_NAME = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-20b',
  })

  return {
    PLANNER,
    CODER,
    PLANNER_PRO,
    CODER_PRO,
    SUMMARIZER,
    CHAT_NAME,
  }
}
