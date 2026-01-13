import { BaseRepository } from './BaseRepository.ts'
import { IPaymentMethodRaw } from '@/domain/entities/IPaymentMethodRaw.ts'
import { IPaymentMethod } from '@/domain/entities/IPaymentMethod.ts'
import PaymentMethodModel from '@/domain/models/PaymentMethodModel.ts'

export default class PaymentMethodRepository extends BaseRepository<
  IPaymentMethodRaw,
  IPaymentMethod
> {
  constructor() {
    super(PaymentMethodModel)
  }
}
