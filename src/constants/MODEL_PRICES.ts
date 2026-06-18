import { IModelPrice } from '@/application/ai/interfaces/IModelPrice.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

export const MODEL_PRICES: Record<ModelsEnum, IModelPrice> = {
  [ModelsEnum.GPT_5_4_NANO]: {
    input: 0.2,
    input_cached: 0.02,
    output: 1.25,
  },
  [ModelsEnum.GPT_5_4_MINI]: {
    input: 0.75,
    input_cached: 0.075,
    output: 4.5,
  },
  [ModelsEnum.GPT_5_5]: {
    input: 5.0,
    input_cached: 0.5,
    output: 30.0,
  },
  [ModelsEnum.GPT_5_4]: {
    input: 2.5,
    input_cached: 0.25,
    output: 15.0,
  },
  [ModelsEnum.GPT_4O_TRANSCRIBE]: {
    input: 2.5,
    output: 10.0,
  },
}
