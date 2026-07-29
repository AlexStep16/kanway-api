import { MODEL_PRICES } from '@/constants/MODEL_PRICES.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { IDurationUsage } from '../interfaces/IDurationUsage.js'

export function calculateAudioCredits(
  durationUsage: IDurationUsage,
  model: ModelsEnum,
  markup: number = 2.5,
  usdToRubRate: number = 78.0,
): number {
  const prices = MODEL_PRICES[model] || MODEL_PRICES[ModelsEnum.GPT_5_4_MINI]

  const duration = durationUsage.seconds ?? 0

  const rawUsdCost = duration * (prices.output / 60)
  const rawRubCost = rawUsdCost * usdToRubRate
  const rubWithMarkup = rawRubCost * markup

  const creditsSpent = rubWithMarkup * 10

  return Math.ceil(creditsSpent)
}
