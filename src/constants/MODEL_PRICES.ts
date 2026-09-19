import { IModelPrice } from '@/application/ai/interfaces/IModelPrice.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

export const MODEL_PRICES: Record<ModelsEnum, IModelPrice> = {
  [ModelsEnum.GEMINI_3_1_PRO_PREVIEW]: {
    tiers: [
      { upTo: 200_000, input: 2, input_cached: 0.2, output: 12 },
      { upTo: Infinity, input: 4, input_cached: 0.4, output: 18 },
    ],
  },
  [ModelsEnum.GEMINI_3_7_FLASH]: {
    tiers: [{ upTo: Infinity, input: 1.5, input_cached: 0.15, output: 7.5 }],
  },
  [ModelsEnum.GEMINI_3_8_FLASH]: {
    tiers: [{ upTo: Infinity, input: 1.5, input_cached: 0.15, output: 7.5 }],
  },
  [ModelsEnum.GPT_5_4_NANO]: {
    tiers: [{ upTo: Infinity, input: 0.2, input_cached: 0.02, output: 1.25 }],
  },
  [ModelsEnum.GPT_5_4_MINI]: {
    tiers: [{ upTo: Infinity, input: 0.75, input_cached: 0.075, output: 4.5 }],
  },
  [ModelsEnum.GPT_5_6_LUNA]: {
    tiers: [
      { upTo: 272_000, input: 0.2, input_cached: 0.02, output: 1.2 },
      { upTo: Infinity, input: 0.4, input_cached: 0.04, output: 1.8 },
    ],
  },
  [ModelsEnum.GPT_5_5]: {
    tiers: [
      { upTo: 272_000, input: 5.0, input_cached: 0.5, output: 30.0 },
      { upTo: Infinity, input: 10.0, input_cached: 1.0, output: 45.0 },
    ],
  },
  [ModelsEnum.GPT_5_4]: {
    tiers: [
      { upTo: 272_000, input: 2.5, input_cached: 0.25, output: 15.0 },
      { upTo: Infinity, input: 5.0, input_cached: 0.5, output: 22.5 },
    ],
  },
  [ModelsEnum.GPT_TRANSCRIBE]: {
    tiers: [{ upTo: Infinity, input: 0, output: 0.0045 }],
  },
}
