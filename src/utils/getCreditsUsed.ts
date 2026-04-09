export const getCreditsUsed = (tokensUsed: number): number => {
  const tokensPerCredit = 15000

  return Math.ceil(tokensUsed / tokensPerCredit)
}
