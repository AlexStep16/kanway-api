import { BaseRepository } from './BaseRepository.js'
import { IPaymentMethodRaw } from '@/domain/entities/IPaymentMethodRaw.js'
import { IPaymentMethod } from '@/domain/entities/IPaymentMethod.js'
import PaymentMethodModel from '@/domain/models/PaymentMethodModel.js'
import { IPaymentMethodCriteria } from '../interfaces/criterias/IPaymentMethodCriteria.js'
import { FilterQuery, Types } from 'mongoose'

export default class PaymentMethodRepository extends BaseRepository<
  IPaymentMethodRaw,
  IPaymentMethod
> {
  constructor() {
    super(PaymentMethodModel)
  }

  public buildFilter(
    criteria: IPaymentMethodCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<IPaymentMethodRaw> {
    const filter: FilterQuery<IPaymentMethodRaw> = {}

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.serviceId) {
      filter.service_id = criteria.serviceId
    }

    if (userId) {
      filter.user_id = userId
    }

    return filter
  }
}
