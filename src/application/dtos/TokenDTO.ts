import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.ts'

export interface TokenDTO {
  token: string
  isActive: boolean
  userId: string
  type: TokenTypesEnum
}
