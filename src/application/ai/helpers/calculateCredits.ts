import { MODEL_PRICES } from '@/constants/MODEL_PRICES.js'
import { ITokenUsage } from '../interfaces/ITokenUsage.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { getEffectiveRate } from '@/utils/getEffectiveRate.js'
import { getModelPriceTier } from './getModelPriceTier.js'

export function calculateCredits(
  tokenUsage: ITokenUsage,
  model: ModelsEnum,
  markup: number = 2.5,
): number {
  const usdToRubRate = getEffectiveRate()
  const modelPrice = MODEL_PRICES[model] || MODEL_PRICES[ModelsEnum.GPT_5_6_LUNA]

  const inputTokens = tokenUsage.input_tokens ?? 0
  const outputTokens = tokenUsage.output_tokens ?? 0
  const cachedTokens = tokenUsage.input_token_details?.cache_read ?? 0

  const prices = getModelPriceTier(modelPrice, inputTokens)

  const nonCachedInput = Math.max(0, inputTokens - cachedTokens)

  const costNonCached = (nonCachedInput / 1_000_000) * prices.input
  const costCached = (cachedTokens / 1_000_000) * (prices.input_cached ?? prices.input)
  const costOutput = (outputTokens / 1_000_000) * prices.output
  const rawUsdCost = costNonCached + costCached + costOutput
  const rawRubCost = rawUsdCost * usdToRubRate

  const rubWithMarkup = rawRubCost * markup

  const creditsSpent = rubWithMarkup * 10

  return Math.ceil(creditsSpent)
}
