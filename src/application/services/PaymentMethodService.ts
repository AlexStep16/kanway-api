import { toServerCaseKeys } from '@utils/objectTransformers.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import PaymentMethodRepository from '@repositories/PaymentMethodRepository.ts'
import { IPaymentMethod } from '@/domain/entities/IPaymentMethod.ts'
import { IPaymentMethodRaw } from '@/domain/entities/IPaymentMethodRaw.ts'
import { PaymentMethodDTO } from '@dtos/PaymentMethodDTO.ts'
import { ClientSession, Types } from 'mongoose'
import { UserService } from '@application/services/UserService.ts'
import { BaseService } from './BaseService.ts'
import { IPaymentMethodCriteria } from '../interfaces/criterias/IPaymentMethodCriteria.ts'

export class PaymentMethodService extends BaseService<
  IPaymentMethodRaw,
  IPaymentMethod,
  IPaymentMethodCriteria
> {
  protected repository: PaymentMethodRepository
  protected userService: UserService

  constructor(paymentRepository: PaymentMethodRepository, userService: UserService) {
    super(paymentRepository)

    this.repository = paymentRepository
    this.userService = userService
  }

  public async create(
    data: PaymentMethodDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IPaymentMethod[]> {
    const paymentMethod: Omit<IPaymentMethod, SystemFields> = {
      serviceId: data.serviceId,
      paymentId: data.paymentId,
      type: data.type,
      cardFirst6: data.cardFirst6,
      cardLast4: data.cardLast4,
      cardType: data.cardType,
      cardExpiryMonth: data.cardExpiryMonth,
      cardExpiryYear: data.cardExpiryYear,
      phone: data.phone,
      userId: userId,
    }

    const newPaymentMethod = await this.repository.create(paymentMethod, session)

    return [toServerCaseKeys<IPaymentMethod>(newPaymentMethod)]
  }

  public async deleteById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.repository.deleteMany({ id }, userId, session)
    // If the deleted payment method was the user's selected payment method, unset it
    const user = await this.userService.getById(userId.toString())
    if (user && user.paymentMethodId === id) {
      const paymentMethods = await this.repository.findByCriteria({}, session, undefined, userId)

      await this.userService.edit(
        { paymentMethodId: paymentMethods[0]?.id.toString() ?? null },
        {},
        user,
      )
    }
  }
}
