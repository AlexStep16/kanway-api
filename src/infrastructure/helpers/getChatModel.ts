import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatOpenAI } from '@langchain/openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

export function getChatModel(model: ModelsEnum, isReasoning: boolean): BaseChatModel {
  switch (model) {
    case ModelsEnum.GEMINI_3_1_PRO_PREVIEW:
      return new ChatGoogleGenerativeAI({
        model: 'gemini-3.1-pro-preview',
        maxRetries: 3,
        thinkingConfig: isReasoning
          ? {
              thinkingLevel: 'MEDIUM',
            }
          : undefined,
        baseUrl: 'https://api.kanway-proxy.org/google',
      })
    case ModelsEnum.GEMINI_3_7_FLASH:
      return new ChatGoogleGenerativeAI({
        model: 'gemini-3.7-flash',
        maxRetries: 3,
        thinkingConfig: isReasoning
          ? {
              thinkingLevel: 'MEDIUM',
            }
          : undefined,
        baseUrl: 'https://api.kanway-proxy.org/google',
      })
    case ModelsEnum.GEMINI_3_8_FLASH:
      return new ChatGoogleGenerativeAI({
        model: 'gemini-3.8-flash',
        maxRetries: 3,
        thinkingConfig: isReasoning
          ? {
              thinkingLevel: 'MEDIUM',
            }
          : undefined,
        baseUrl: 'https://api.kanway-proxy.org/google',
      })
    case ModelsEnum.GPT_5_4_MINI:
      return new ChatOpenAI({
        model: 'gpt-5.4-mini',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
        configuration: {
          baseURL: 'https://api.kanway-proxy.org/v1',
        },
      })
    case ModelsEnum.GPT_5_6_LUNA:
      return new ChatOpenAI({
        model: 'gpt-5.6-luna',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
        configuration: {
          baseURL: 'https://api.kanway-proxy.org/v1',
        },
      })
    case ModelsEnum.GPT_5_4:
      return new ChatOpenAI({
        model: 'gpt-5.4',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
        configuration: {
          baseURL: 'https://api.kanway-proxy.org/v1',
        },
      })
    case ModelsEnum.GPT_5_5:
      return new ChatOpenAI({
        model: 'gpt-5.5',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
        configuration: {
          baseURL: 'https://api.kanway-proxy.org/v1',
        },
      })
    case ModelsEnum.GPT_5_4_NANO:
      return new ChatOpenAI({
        model: 'gpt-5.4-nano',
        useResponsesApi: true,
        reasoning: isReasoning ? { effort: 'medium' } : undefined,
        maxRetries: 3,
        configuration: {
          baseURL: 'https://api.kanway-proxy.org/v1',
        },
      })
    case ModelsEnum.GPT_TRANSCRIBE:
      return new ChatOpenAI({
        model: 'gpt-transcribe',
        maxRetries: 3,
        configuration: {
          baseURL: 'https://api.kanway-proxy.org/v1',
        },
      })
  }
}
