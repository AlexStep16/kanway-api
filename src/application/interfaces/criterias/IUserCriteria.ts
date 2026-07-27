import { IBaseCriteria } from './IBaseCriteria.js'

export interface IUserCriteria extends IBaseCriteria {
  email?: string
  vkUserId?: string
  yandexUserId?: string
}
