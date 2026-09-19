export interface IModelPriceTier {
  /** Upper bound (inclusive) of input tokens this tier applies to. Use Infinity for the last tier. */
  upTo: number
  input: number
  input_cached?: number
  output: number
}

export interface IModelPrice {
  tiers: IModelPriceTier[]
}
