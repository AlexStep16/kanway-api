import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.js'

export interface TokenDTO {
  token: string
  isActive: boolean
  userId: string
  type: TokenTypesEnum
}
