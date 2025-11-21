import { toServerCaseKeys } from '@utils/objectTransformers.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import PaymentRepository from '@repositories/PaymentRepository.ts'
import { IPayment } from '@/domain/entities/IPayment.ts'
import { IPaymentRaw } from '@/domain/entities/IPaymentRaw.ts'
import { PaymentDTO } from '@dtos/PaymentDTO.ts'
import { ClientSession, Types } from 'mongoose'
import { ICreateWithUserIdService } from '../interfaces/traits/ICreateWithUserIdService.ts'
import { IGetAllByUserIdService } from '../interfaces/traits/IGetAllByUserIdService.ts'
import { IGetByIdService } from '../interfaces/traits/IGetByIdService.ts'

export class PaymentService
  implements
    ICreateWithUserIdService<IPayment, PaymentDTO>,
    IGetAllByUserIdService<IPayment>,
    IGetByIdService<IPayment>
{
  protected repository: PaymentRepository

  constructor(paymentRepository: PaymentRepository) {
    this.repository = paymentRepository
  }

  public async create(
    data: PaymentDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPayment[]> {
    const payment: Omit<IPaymentRaw, SystemFields> = {
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      user_id: userId,
    }

    const newPayment = await this.repository.create(payment, session)

    return [toServerCaseKeys<IPayment>(newPayment)]
  }

  public async getAllByUserId(
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPayment[]> {
    const payments = await this.repository.getByUserId(userId, session)

    return payments.map(toServerCaseKeys<IPayment>)
  }

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPayment | null> {
    const payment = await this.repository.getById(id, userId, session)

    return toServerCaseKeys<IPayment>(payment)
  }
}
