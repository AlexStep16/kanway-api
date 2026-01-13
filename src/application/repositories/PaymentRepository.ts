import { IPaymentRaw } from '@entities/IPaymentRaw.ts'
import PaymentModel from '@models/PaymentModel.ts'
import { IPayment } from '@/domain/entities/IPayment.ts'
import { BaseRepository } from './BaseRepository.ts'

export default class PaymentRepository extends BaseRepository<IPaymentRaw, IPayment> {
  constructor() {
    super(PaymentModel)
  }
}
