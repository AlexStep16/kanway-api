import { ModelCostRatio } from '@/domain/enums/ModelCostRatio.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

const MODELS_COST_RATIOS: Record<ModelsEnum, ModelCostRatio> = {
  [ModelsEnum.KANWAY_LITE]: ModelCostRatio.Lite,
  [ModelsEnum.KANWAY_PRO]: ModelCostRatio.Pro,
  [ModelsEnum.KANWAY_AUDIO]: ModelCostRatio.Audio,
}

export const getCreditsUsed = (tokensUsed: number, modelType: ModelsEnum): number => {
  const TOKENS_PER_CREDIT = 5000

  const ratio = MODELS_COST_RATIOS[modelType] || ModelCostRatio.Lite

  const normalizedTokens = tokensUsed * ratio

  const creditsToCharge = Math.ceil(normalizedTokens / TOKENS_PER_CREDIT)

  return tokensUsed > 0 ? Math.max(creditsToCharge, 1) : 0
}
