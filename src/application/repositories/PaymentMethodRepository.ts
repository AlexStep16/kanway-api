import { BaseRepository } from './BaseRepository.ts'
import { IPaymentMethodRaw } from '@/domain/entities/IPaymentMethodRaw.ts'
import { IPaymentMethod } from '@/domain/entities/IPaymentMethod.ts'
import PaymentMethodModel from '@/domain/models/PaymentMethodModel.ts'
import { IPaymentMethodCriteria } from '../interfaces/criterias/IPaymentMethodCriteria.ts'
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
