export function getEffectiveRate(): number {
  return process.env.EFFECTIVE_USD_RUB_RATE ? Number(process.env.EFFECTIVE_USD_RUB_RATE) : 100
}
