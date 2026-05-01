import { IBaseCriteria } from './IBaseCriteria.js'

export interface IUserCriteria extends IBaseCriteria {
  email?: string
  vkClientId?: string
  yandexClientId?: string
}
