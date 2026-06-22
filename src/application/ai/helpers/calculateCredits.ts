import { MODEL_PRICES } from '@/constants/MODEL_PRICES.js'
import { ITokenUsage } from '../interfaces/ITokenUsage.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'

export function calculateCredits(
  tokenUsage: ITokenUsage,
  model: ModelsEnum,
  markup: number = 2.5,
  usdToRubRate: number = 78.0,
): number {
  const prices = MODEL_PRICES[model] || MODEL_PRICES[ModelsEnum.GPT_5_4_MINI]

  const inputTokens = tokenUsage.input_tokens ?? 0
  const outputTokens = tokenUsage.output_tokens ?? 0
  const cachedTokens = tokenUsage.input_token_details?.cache_read ?? 0

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
