import { toServerCaseKeys } from '@utils/objectTransformers.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import PaymentMethodRepository from '@repositories/PaymentMethodRepository.ts'
import { IPaymentMethod } from '@/domain/entities/IPaymentMethod.ts'
import { IPaymentMethodRaw } from '@/domain/entities/IPaymentMethodRaw.ts'
import { PaymentMethodDTO } from '@dtos/PaymentMethodDTO.ts'
import { ClientSession, Types } from 'mongoose'
import { UserService } from '@application/services/UserService.ts'
import { ICreateWithUserIdService } from '../interfaces/traits/ICreateWithUserIdService.ts'
import { IGetAllByUserIdService } from '../interfaces/traits/IGetAllByUserIdService.ts'
import { IGetByIdService } from '../interfaces/traits/IGetByIdService.ts'
import { IDeleteByIdService } from '../interfaces/traits/IDeleteByIdService.ts'

export class PaymentMethodService
  implements
    ICreateWithUserIdService<IPaymentMethod, PaymentMethodDTO>,
    IGetAllByUserIdService<IPaymentMethod>,
    IGetByIdService<IPaymentMethod>,
    IDeleteByIdService
{
  protected repository: PaymentMethodRepository
  protected userService: UserService

  constructor(paymentRepository: PaymentMethodRepository, userService: UserService) {
    this.repository = paymentRepository
    this.userService = userService
  }

  public async create(
    data: PaymentMethodDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPaymentMethod[]> {
    const paymentMethod: Omit<IPaymentMethodRaw, SystemFields> = {
      service_id: data.serviceId,
      type: data.type,
      card_first_6: data.cardFirst6,
      card_last_4: data.cardLast4,
      card_type: data.cardType,
      expiry_month: data.expiryMonth,
      expiry_year: data.expiryYear,
      user_id: userId,
    }

    const newPaymentMethod = await this.repository.create(paymentMethod, session)

    return [toServerCaseKeys<IPaymentMethod>(newPaymentMethod)]
  }

  public async deleteById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    await this.repository.deleteById(id, userId, session)
    // If the deleted payment method was the user's selected payment method, unset it
    const user = await this.userService.getById(userId.toString())
    if (user && user.paymentMethodId === id) {
      const paymentMethods = await this.repository.getByUserId(userId)

      await this.userService.edit(
        { paymentMethodId: paymentMethods[0]?._id.toString() ?? null },
        {},
        user
      )
    }
  }

  public async getAllByUserId(
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPaymentMethod[]> {
    const payments = await this.repository.getByUserId(userId, session)

    return payments.map(toServerCaseKeys<IPaymentMethod>)
  }

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPaymentMethod | null> {
    const payment = await this.repository.getById(id, userId, session)

    return toServerCaseKeys<IPaymentMethod>(payment)
  }
}
