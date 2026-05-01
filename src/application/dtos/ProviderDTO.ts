import { ProvidersEnum } from '@/domain/enums/ProvidersEnum.js'

export interface ProviderDTO {
  provider: ProvidersEnum
  clientId: string
  avatarUrl?: string
  username: string
}
