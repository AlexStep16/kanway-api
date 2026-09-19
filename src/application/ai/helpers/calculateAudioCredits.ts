import { MODEL_PRICES } from '@/constants/MODEL_PRICES.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { IDurationUsage } from '../interfaces/IDurationUsage.js'
import { getEffectiveRate } from '@/utils/getEffectiveRate.js'

export function calculateAudioCredits(
  durationUsage: IDurationUsage,
  model: ModelsEnum,
  markup: number = 2.5,
): number {
  const usdToRubRate = getEffectiveRate()
  const modelPrice = MODEL_PRICES[model] || MODEL_PRICES[ModelsEnum.GPT_TRANSCRIBE]
  const prices = modelPrice.tiers[0]

  const duration = durationUsage.seconds ?? 0

  const rawUsdCost = duration * (prices.output / 60)
  const rawRubCost = rawUsdCost * usdToRubRate
  const rubWithMarkup = rawRubCost * markup

  const creditsSpent = rubWithMarkup * 10

  return Math.ceil(creditsSpent)
}
