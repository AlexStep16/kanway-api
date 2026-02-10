import { Types } from 'mongoose'
import { ThemesEnum } from '../enums/ThemesEnum.ts'

export interface ISupport {
  id: Types.ObjectId
  name: string
  email: string
  theme: ThemesEnum
  details: string
  createdAt: Date
  updatedAt: Date
}
