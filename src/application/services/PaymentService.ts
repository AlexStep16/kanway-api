import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import PaymentRepository from '@repositories/PaymentRepository.ts'
import { IPayment } from '@/domain/entities/IPayment.ts'
import { IPaymentRaw } from '@/domain/entities/IPaymentRaw.ts'
import { PaymentDTO } from '@dtos/PaymentDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { BaseService } from './BaseService.ts'
import { IPaymentCriteria } from '@interfaces/criterias/IPaymentCriteria.ts'
import { type ICreatePayment, Payment, WebHookEvents, YooCheckout } from '@a2seven/yoo-checkout'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { UserService } from './UserService.ts'
import { PaymentMethodService } from './PaymentMethodService.ts'
import { PaymentStatusesEnum } from '@/domain/enums/PaymentStatusesEnum.ts'
import { EmailService } from '@/infrastructure/services/EmailService.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { subscriptionQueue } from '@/infrastructure/queues/SubscriptionQueue.ts'
import { IPaymentMethod } from '@/domain/entities/IPaymentMethod.ts'
import dayjs from 'dayjs'

export class PaymentService extends BaseService<IPaymentRaw, IPayment, IPaymentCriteria> {
  protected repository: PaymentRepository
  protected userService: UserService
  protected paymentMethodService: PaymentMethodService
  protected emailService: EmailService

  constructor(
    paymentRepository: PaymentRepository,
    userService: UserService,
    paymentMethodService: PaymentMethodService,
    emailService: EmailService,
  ) {
    super(paymentRepository)

    this.repository = paymentRepository
    this.userService = userService
    this.paymentMethodService = paymentMethodService
    this.emailService = emailService
  }

  public async create(
    data: PaymentDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IPayment> {
    const payment: Omit<IPayment, SystemFields> = {
      serviceId: data.serviceId,
      type: data.type,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      userId,
    }

    return await this.repository.create(payment, session)
  }

  public async createPayment(
    createPayload: ICreatePayment,
    plan: SubscriptionPlanEnum,
    userId: Types.ObjectId,
  ) {
    const checkout = new YooCheckout({
      shopId: process.env.YOO_SHOP_ID ?? '',
      secretKey: process.env.YOO_SECRET ?? '',
    })

    const idempotenceKey = crypto.randomUUID()
    const payment = await checkout.createPayment(createPayload, idempotenceKey)
    const paymentData = {
      serviceId: payment.id,
      description: createPayload.description ?? 'Subscription Payment',
      amount: createPayload.amount.value,
      currency: createPayload.amount.currency,
      type: plan,
      status: payment.status as PaymentStatusesEnum,
    }

    const paymentModel = await this.create(paymentData, userId)

    return {
      payment,
      model: paymentModel,
    }
  }

  private _getBusinessCreatePayload(user: IUser): ICreatePayment {
    return {
      amount: {
        value: '999.00',
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: 'http://localhost:3000/payment/confirmation',
      },
      receipt: {
        customer: {
          email: user.email,
        },
        items: [
          {
            description: 'Бизнес подписка Kanbar',
            quantity: '1',
            amount: {
              value: '999.00',
              currency: 'RUB',
            },
            vat_code: 1,
            payment_mode: 'full_payment',
            payment_subject: 'service',
          },
        ],
      },
      capture: true,
      description: 'Оплата бизнес подписки',
      save_payment_method: true,
    }
  }

  private _getPremiumCreatePayload(user: IUser): ICreatePayment {
    return {
      amount: {
        value: '599.00',
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: 'http://localhost:3000/payment/premium/confirmation',
      },
      receipt: {
        customer: {
          email: user.email,
        },
        items: [
          {
            description: 'Премиум подписка Kanbar',
            quantity: '1',
            amount: {
              value: '599.00',
              currency: 'RUB',
            },
            vat_code: 1,
            payment_mode: 'full_payment',
            payment_subject: 'service',
          },
        ],
      },
      capture: true,
      description: 'Оплата премиум подписки',
      save_payment_method: true,
    }
  }

  private async _getCreatePayloadByPlan(
    user: IUser,
    plan: SubscriptionPlanEnum,
  ): Promise<ICreatePayment | null> {
    if (plan === SubscriptionPlanEnum.Business) {
      return this._getBusinessCreatePayload(user)
    } else if (plan === SubscriptionPlanEnum.Premium) {
      return this._getPremiumCreatePayload(user)
    } else return null
  }

  public async downgradeSubscription(user: IUser, plan: SubscriptionPlanEnum) {
    if (user.subscriptionId < plan && user.isSubscriptionActive) {
      throw new AppError('Функция доступна только для понижения.', 500)
    }
    if (user.subscriptionId === plan && user.isSubscriptionActive) {
      throw new AppError('Пользователь уже имеет активную подписку.', 500)
    }

    return await this.userService.edit(
      {
        pendingChangePlan: plan,
      },
      { id: user.id.toString() },
    )
  }

  public async downgradeCancelSubscription(user: IUser) {
    return await this.userService.edit(
      {
        pendingChangePlan: null,
      },
      { id: user.id.toString() },
    )
  }

  public async upgradeSubscription(user: IUser, plan: SubscriptionPlanEnum) {
    if (user.subscriptionId === SubscriptionPlanEnum.Basic) {
      throw new AppError('У пользователя нет активной подписки для апгрейда.', 500)
    }
    if (user.subscriptionId > plan && user.isSubscriptionActive) {
      throw new AppError('Функция доступна только для повышения.', 500)
    }
    if (user.subscriptionId === plan && user.isSubscriptionActive) {
      throw new AppError('Пользователь уже имеет активную подписку.', 500)
    }

    const createPayload: ICreatePayment | null = await this._getCreatePayloadByPlan(user, plan)

    if (!createPayload) {
      throw new AppError('Неверный план подписки.', 400)
    }

    const now = dayjs()
    const end = dayjs(user.subscriptionUntil)

    const newPlanPrice = parseFloat(createPayload.amount.value)

    let finalAmount = newPlanPrice

    if (user.isSubscriptionActive && user.subscriptionUntil && end.isAfter(now)) {
      const daysRemaining = end.diff(now, 'day', true)
      const daysInMonth = now.daysInMonth()

      const oldPlanPrice = user.subscriptionId === SubscriptionPlanEnum.Premium ? 599 : 999

      const unusedValue = oldPlanPrice * (daysRemaining / daysInMonth)
      finalAmount = newPlanPrice - unusedValue

      if (finalAmount < 1) finalAmount = 1
    }

    createPayload.amount.value = Math.floor(finalAmount).toFixed(2)

    return await this.createPayment(createPayload, plan, user.id)
  }

  public async buySubscription(user: IUser, plan: SubscriptionPlanEnum) {
    const createPayload: ICreatePayment | null = await this._getCreatePayloadByPlan(user, plan)

    if (!createPayload) {
      throw new AppError('Неверный план подписки.', 400)
    }

    if (user.subscriptionId !== SubscriptionPlanEnum.Basic && user.isSubscriptionActive) {
      throw new AppError('Пользователь уже имеет активную подписку.', 500)
    }

    return await this.createPayment(createPayload, plan, user.id)
  }

  public async cancelSubscription(user: IUser) {
    if (!user.isSubscriptionActive) {
      throw new AppError('У пользователя нет активной подписки.', 500)
    }

    return await this.userService.edit(
      {
        isSubscriptionActive: false,
        pendingChangePlan: null,
      },
      { id: user.id.toString() },
    )
  }

  public async resumeSubscription(user: IUser) {
    if (user.isSubscriptionActive) {
      throw new AppError('У пользователя уже есть активная подписка.', 500)
    }

    await this.userService.edit(
      {
        isSubscriptionActive: true,
      },
      { id: user.id.toString() },
    )
  }

  private async _revertToBasicPlan(userId: string) {
    await this.userService.edit(
      {
        subscriptionId: SubscriptionPlanEnum.Basic,
        isSubscriptionActive: false,
        subscriptionUntil: null,
      },
      { id: userId },
    )
  }

  public async autoChargeSubscription(userId: string) {
    const user = await this.userService.getById(userId)

    const checkout = new YooCheckout({
      shopId: process.env.YOO_SHOP_ID ?? '',
      secretKey: process.env.YOO_SECRET ?? '',
    })

    if (!user) return

    if (!user.isSubscriptionActive || !user.paymentMethodId) {
      return await this._revertToBasicPlan(userId)
    }

    if (user.pendingChangePlan) {
      const editResult = await this.userService.edit(
        {
          subscriptionId: user.pendingChangePlan,
          pendingChangePlan: null,
        },
        { id: userId },
      )

      Object.assign(user, editResult)
    }

    const paymentMethods = await this.paymentMethodService.getByCriteria(
      {
        id: user.paymentMethodId,
      },
      user.id,
    )

    if (paymentMethods.length === 0) return await this._revertToBasicPlan(userId)

    const paymentMethod = paymentMethods[0]

    const plan = user.subscriptionId
    const planText = plan === SubscriptionPlanEnum.Business ? 'Бизнес' : 'Премиум'
    const amount = plan === SubscriptionPlanEnum.Business ? '999.00' : '599.00'

    const dateKey = new Date().toISOString().slice(0, 10)
    const idempotenceKey = `auto_${userId}_${dateKey}`

    const payment = await checkout.createPayment(
      {
        amount: {
          value: amount,
          currency: 'RUB',
        },
        capture: true,
        payment_method_id: paymentMethod.serviceId,
        description: `Продление ${planText} подписки Kanbar`,
      },
      idempotenceKey,
    )

    const paymentData = {
      serviceId: payment.id,
      description: `Продление ${planText} подписки Kanbar`,
      amount: payment.amount.value,
      currency: payment.amount.currency,
      type: plan,
      status: payment.status as PaymentStatusesEnum,
    }

    await this.create(paymentData, new Types.ObjectId(userId))
  }

  private async _handleSuccessNotification(
    checkedPayment: Payment,
    paymentModel: IPayment,
    session: ClientSession,
    user: IUser,
  ) {
    const nextBillingDate = dayjs().add(1, 'month').toDate()

    await this.userService.edit(
      {
        subscriptionId: paymentModel.type,
        paymentRetriesCount: 0,
        isSubscriptionActive: true,
        pendingChangePlan: null,
        subscriptionUntil: nextBillingDate,
      },
      { id: paymentModel.userId.toString() },
      undefined,
      session,
    )

    if (checkedPayment?.payment_method?.id) {
      let paymentMethod: IPaymentMethod = {} as IPaymentMethod

      const paymentMethods = await this.paymentMethodService.getByCriteria(
        {
          serviceId: checkedPayment.payment_method.id,
        },
        user.id,
        session,
      )

      paymentMethod = paymentMethods[0]

      if (paymentMethods.length === 0) {
        const paymentMethodResult = await this.paymentMethodService.create(
          {
            paymentId: checkedPayment.id,
            serviceId: checkedPayment.payment_method.id,
            type: checkedPayment.payment_method.type,
            cardType: checkedPayment.payment_method.card?.card_type || '',
            cardFirst6: checkedPayment.payment_method.card?.first6,
            cardLast4: checkedPayment.payment_method.card?.last4,
            cardExpiryMonth: checkedPayment.payment_method.card?.expiry_month,
            cardExpiryYear: checkedPayment.payment_method.card?.expiry_year,
            phone: checkedPayment.payment_method.phone,
            userId: user.id.toString(),
          },
          user.id,
          session,
        )

        paymentMethod = paymentMethodResult[0]
      }

      await this.userService.edit(
        {
          paymentMethodId: paymentMethod.id.toString(),
        },
        { id: user.id.toString() },
        undefined,
        session,
      )
    }

    const subscriptionName =
      paymentModel.type === SubscriptionPlanEnum.Business ? 'Бизнес' : 'Премиум'

    await this.emailService.sendPaymentSuccessEmail(user, {
      subscription_name: subscriptionName,
      amount: paymentModel.amount,
      date: new Date().toISOString(),
      next_billing_date: nextBillingDate.toISOString(),
    })

    const delay = nextBillingDate.getTime() - Date.now()

    await subscriptionQueue.add(
      'renew-subscription',
      { userId: paymentModel.userId.toString() },
      {
        delay: delay,
        jobId: `renew_${paymentModel.userId}_${nextBillingDate.getTime()}`, // Уникальный ID задачи
      },
    )
  }

  private async _handleCanceledNotification(
    paymentModel: IPayment,
    session: ClientSession,
    user: IUser,
  ) {
    if (user.isSubscriptionActive === false) return

    const newCount = (user.paymentRetriesCount || 0) + 1

    await this.userService.edit(
      {
        paymentRetriesCount: newCount,
      },
      { id: user.id.toString() },
      undefined,
      session,
    )

    if (newCount >= 3) {
      await this.userService.edit(
        {
          isSubscriptionActive: false,
          subscriptionId: SubscriptionPlanEnum.Basic,
          subscriptionUntil: null,
        },
        { id: user.id.toString() },
        undefined,
        session,
      )

      await this.emailService.sendPaymentFinalFailedEmail(user)
    } else {
      let daysLeft = ''
      let delay = 0

      if (newCount === 1) {
        daysLeft = '3'
        delay = 1000 * 60 * 60 * 24 * 1
      } else if (newCount === 2) {
        daysLeft = '2'
        delay = 1000 * 60 * 60 * 24 * 2
      }

      await this.emailService.sendPaymentFailedEmail(user, paymentModel.amount, daysLeft)

      await subscriptionQueue.add(
        'renew-subscription',
        { userId: paymentModel.userId.toString() },
        {
          delay: delay,
          jobId: `renew_${paymentModel.userId}_${Date.now()}`, // Уникальный ID задачи
        },
      )
    }
  }

  public async handleNotification(notification: {
    id: string
    event: WebHookEvents
    object: Payment
  }) {
    const checkout = new YooCheckout({
      shopId: process.env.YOO_SHOP_ID ?? '',
      secretKey: process.env.YOO_SECRET ?? '',
    })

    const payment = notification.object

    const payments = await this.getByCriteria({
      serviceId: payment.id,
    })

    if (payments.length === 0) {
      throw new AppError(ErrorMessages.PAYMENT_NOT_FOUND, 500)
    }

    const paymentModel = payments[0]

    const user = await this.userService.getById(paymentModel.userId.toString())

    const checkedPayment = await checkout.getPayment(payment.id)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 500)
    }
    if (!checkedPayment) {
      throw new AppError(ErrorMessages.PAYMENT_NOT_FOUND, 500)
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      await this.repository.updateManyByCriteria(
        { id: paymentModel.id },
        { status: checkedPayment.status as PaymentStatusesEnum },
        session,
      )

      if (checkedPayment.status === 'succeeded') {
        await this._handleSuccessNotification(checkedPayment, paymentModel, session, user)
      } else if (checkedPayment.status === 'canceled') {
        await this._handleCanceledNotification(paymentModel, session, user)
      }

      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }
}
