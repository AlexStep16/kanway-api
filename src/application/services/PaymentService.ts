import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import PaymentRepository from '@repositories/PaymentRepository.ts'
import { IPayment } from '@/domain/entities/IPayment.ts'
import { IPaymentRaw } from '@/domain/entities/IPaymentRaw.ts'
import { PaymentDTO } from '@dtos/PaymentDTO.ts'
import { ClientSession, Types } from 'mongoose'
import { BaseService } from './BaseService.ts'
import { IPaymentCriteria } from '@interfaces/criterias/IPaymentCriteria.ts'

export class PaymentService extends BaseService<IPaymentRaw, IPayment, IPaymentCriteria> {
  protected repository: PaymentRepository

  constructor(paymentRepository: PaymentRepository) {
    super(paymentRepository)

    this.repository = paymentRepository
  }

  public async create(
    data: PaymentDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPayment> {
    const payment: Omit<IPayment, SystemFields> = {
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      userId,
    }

    return await this.repository.create(payment, session)
  }
}
