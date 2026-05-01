import { toServerCaseKeys } from '@utils/objectTransformers.js'
import { SystemFields } from '@infrastructure/types/SystemFields.js'
import PaymentMethodRepository from '@repositories/PaymentMethodRepository.js'
import { IPaymentMethod } from '@/domain/entities/IPaymentMethod.js'
import { IPaymentMethodRaw } from '@/domain/entities/IPaymentMethodRaw.js'
import { PaymentMethodDTO } from '@dtos/PaymentMethodDTO.js'
import { ClientSession, Types } from 'mongoose'
import { UserService } from '@application/services/UserService.js'
import { BaseService } from './BaseService.js'
import { IPaymentMethodCriteria } from '../interfaces/criterias/IPaymentMethodCriteria.js'

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
    const user = await this.userService.getById(userId.toString(), session)

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
