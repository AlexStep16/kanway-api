import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.ts'
import { Types } from 'mongoose'

export interface ITokenCreatePayload {
  token: string
  userId: Types.ObjectId
  type: TokenTypesEnum
}
