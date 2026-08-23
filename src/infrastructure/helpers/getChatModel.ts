import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatOpenAI } from '@langchain/openai'

export function getChatModel(model: ModelsEnum, isReasoning: boolean): BaseChatModel {
  switch (model) {
    case ModelsEnum.GPT_5_4_MINI:
      return new ChatOpenAI({
        model: 'gpt-5.4-mini',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
      })
    case ModelsEnum.GPT_5_4:
      return new ChatOpenAI({
        model: 'gpt-5.4',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
      })
    case ModelsEnum.GPT_5_5:
      return new ChatOpenAI({
        model: 'gpt-5.5',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
      })
    case ModelsEnum.GPT_5_4_NANO:
      return new ChatOpenAI({
        model: 'gpt-5.4-nano',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
      })
    case ModelsEnum.GPT_TRANSCRIBE:
      return new ChatOpenAI({
        model: 'gpt-transcribe',
        maxRetries: 3,
      })
  }
}
