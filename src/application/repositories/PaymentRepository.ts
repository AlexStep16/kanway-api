import { IPaymentRaw } from '@entities/IPaymentRaw.js'
import PaymentModel from '@models/PaymentModel.js'
import { IPayment } from '@/domain/entities/IPayment.js'
import { BaseRepository } from './BaseRepository.js'
import { IPaymentCriteria } from '../interfaces/criterias/IPaymentCriteria.js'
import { FilterQuery, Types } from 'mongoose'

export default class PaymentRepository extends BaseRepository<
  IPaymentRaw,
  IPayment,
  IPaymentCriteria
> {
  constructor() {
    super(PaymentModel)
  }

  public buildFilter(
    criteria: IPaymentCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<IPaymentRaw> {
    const filter: FilterQuery<IPaymentRaw> = {}

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
