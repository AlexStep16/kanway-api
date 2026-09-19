import { IModelPrice, IModelPriceTier } from '../interfaces/IModelPrice.js'

/** Picks the pricing tier matching the given input token count (tiers must be sorted ascending by upTo). */
export function getModelPriceTier(prices: IModelPrice, inputTokens: number): IModelPriceTier {
  return (
    prices.tiers.find((tier) => inputTokens <= tier.upTo) ?? prices.tiers[prices.tiers.length - 1]
  )
}
