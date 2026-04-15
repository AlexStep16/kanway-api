import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.js'
import { Types } from 'mongoose'

export interface ITokenCreatePayload {
  token: string
  userId: Types.ObjectId
  type: TokenTypesEnum
}
