export interface ISubscription {
  id: number
  name: string
  price: number
  currency: string
  interval: 'month' | 'year'
  limitWorkspaces: number
  limitBoards: number
  limitAiMessagesPerMonth: number
}
