import { SystemFields } from '@infrastructure/types/SystemFields.js'
import PaymentRepository from '@repositories/PaymentRepository.js'
import { IPayment } from '@/domain/entities/IPayment.js'
import { IPaymentRaw } from '@/domain/entities/IPaymentRaw.js'
import { PaymentDTO } from '@dtos/PaymentDTO.js'
import mongoose, { ClientSession, DeleteResult, Types } from 'mongoose'
import { BaseService } from './BaseService.js'
import { IPaymentCriteria } from '@interfaces/criterias/IPaymentCriteria.js'
import { type ICreatePayment, Payment, WebHookEvents, YooCheckout } from '@a2seven/yoo-checkout'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'
import { IUser } from '@/domain/entities/IUser.js'
import { AppError } from '@/domain/errors/AppError.js'
import { UserService } from './UserService.js'
import { PaymentMethodService } from './PaymentMethodService.js'
import { PaymentStatusesEnum } from '@/domain/enums/PaymentStatusesEnum.js'
import { EmailService } from '@/infrastructure/services/EmailService.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import dayjs from 'dayjs'
import { CREDIT_PACKS_DATA } from '@/constants/CREDIT_PACKS_DATA.js'
import { PaymentTypeEnum } from '@/domain/enums/PaymentTypeEnum.js'
import { SUBSCRIPTION_PLAN_TO_ITEM_ID } from '@/constants/SUBSCRIPTION_PLAN_TO_ITEM_ID.js'
import { PaymentItemIdEnum } from '@/domain/enums/PaymentItemIdEnum.js'
import { SUBSCRIPTION_ITEM_ID_TO_PLAN } from '@/constants/SUBSCRIPTION_ITEM_ID_TO_PLAN.js'
import { SUBSCRIPTION_PLAN_TO_CREDITS } from '@/constants/SUBSCRIPTION_PLAN_TO_CREDITS.js'
import { SUBSCRIPTION_PLAN_PRICES } from '@/constants/SUBSCRIPTION_PLAN_PRICES.js'
import * as Sentry from '@sentry/node'
import { PaymentEditDTO } from '../dtos/PaymentEditDTO.js'

type CreditItemId =
  | PaymentItemIdEnum.CREDIT_PACK_SMALL
  | PaymentItemIdEnum.CREDIT_PACK_MEDIUM
  | PaymentItemIdEnum.CREDIT_PACK_LARGE
type SubscriptionItemId =
  | PaymentItemIdEnum.BASIC
  | PaymentItemIdEnum.PREMIUM
  | PaymentItemIdEnum.ARCHITECTOR
type PostCommitAction = () => Promise<void>

export class PaymentService extends BaseService<IPaymentRaw, IPayment, IPaymentCriteria> {
  protected repository: PaymentRepository
  protected userService: UserService
  protected paymentMethodService: PaymentMethodService
  protected emailService: EmailService

  private checkout: YooCheckout
  private readonly frontUrl: string

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

    this.checkout = new YooCheckout({
      shopId: process.env.YOO_SHOP_ID ?? '',
      secretKey: process.env.YOO_SECRET ?? '',
    })
    this.frontUrl = process.env.FRONT_URL || 'https://kanway.ru'
  }

  private _getPlanLabel(plan: SubscriptionPlanEnum): string {
    return plan === SubscriptionPlanEnum.Architector ? 'Архитектор' : 'Премиум'
  }

  private _getSubscriptionAmount(plan: SubscriptionPlanEnum): string {
    return SUBSCRIPTION_PLAN_PRICES[plan].toFixed(2)
  }

  private _buildBasePayload(user: IUser, amount: string, description: string, paymentId: string) {
    return {
      amount: { value: amount, currency: 'RUB' },
      confirmation: {
        type: 'redirect' as const,
        return_url: `${this.frontUrl}/workspace?paymentId=${paymentId}`,
      },
      receipt: {
        customer: { email: user.email },
        items: [
          {
            description,
            quantity: '1',
            amount: { value: amount, currency: 'RUB' },
            vat_code: 1,
            payment_mode: 'full_payment' as const,
            payment_subject: 'service' as const,
          },
        ],
      },
      capture: true,
      description,
    }
  }

  private async _initiateCheckoutPayment(
    paymentData: PaymentDTO,
    user: IUser,
    buildPayload: (paymentModelId: string) => ICreatePayment,
  ): Promise<{ payment: Payment; model: IPayment }> {
    const paymentModel = await this.create(paymentData, user.id)
    const createPayload = buildPayload(paymentModel.id.toString())
    const idempotenceKey = crypto.randomUUID()
    const payment = await this.checkout.createPayment(createPayload, idempotenceKey)
    const updateResult = await this.edit(
      { serviceId: payment.id },
      { id: paymentModel.id.toString() },
      user,
    )
    return { payment, model: updateResult[0] }
  }

  public async getPaymentStatus(serviceId: string) {
    return await this.checkout.getPayment(serviceId)
  }

  public async create(
    data: PaymentDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IPayment> {
    const payment: Omit<IPayment, SystemFields> = {
      serviceId: data.serviceId,
      itemId: data.itemId,
      column: data.column,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      userId,
    }

    return this.repository.create(payment, session)
  }

  private _getCreditPackPayload(
    user: IUser,
    itemId: CreditItemId,
    amount: string,
    description: string,
    paymentId: string,
  ): ICreatePayment {
    return {
      ...this._buildBasePayload(user, amount, description, paymentId),
      metadata: {
        paymentType: PaymentTypeEnum.CREDIT_PACK,
        itemId,
        paymentId,
      },
    }
  }

  private _getSubscriptionPayload(
    user: IUser,
    amount: string,
    description: string,
    paymentId: string,
    itemId: PaymentItemIdEnum,
  ): ICreatePayment {
    return {
      ...this._buildBasePayload(user, amount, description, paymentId),
      metadata: {
        paymentId,
        paymentType: PaymentTypeEnum.SUBSCRIPTION,
        itemId,
      },
      save_payment_method: true,
    }
  }

  public async downgradeSubscription(user: IUser, plan: SubscriptionPlanEnum) {
    if (user.subscriptionId < plan && user.isSubscriptionActive) {
      throw new AppError('Функция доступна только для понижения', 500)
    }
    if (user.subscriptionId === plan && user.isSubscriptionActive) {
      throw new AppError('Пользователь уже имеет активную подписку', 500)
    }

    return this.userService.edit(
      {
        pendingChangePlan: plan,
      },
      { id: user.id.toString() },
    )
  }

  public async cancelPendingDowngrade(user: IUser) {
    return this.userService.edit(
      {
        pendingChangePlan: null,
      },
      { id: user.id.toString() },
    )
  }

  public async upgradeSubscription(user: IUser, plan: SubscriptionPlanEnum) {
    if (user.subscriptionId === SubscriptionPlanEnum.Basic) {
      throw new AppError('У пользователя нет активной подписки для апгрейда', 500)
    }
    if (user.subscriptionId > plan && user.isSubscriptionActive) {
      throw new AppError('Функция доступна только для повышения', 500)
    }
    if (user.subscriptionId === plan && user.isSubscriptionActive) {
      throw new AppError('Пользователь уже имеет активную подписку', 500)
    }

    const now = dayjs()
    const end = dayjs(user.subscriptionUntil)

    const newPlanPrice = SUBSCRIPTION_PLAN_PRICES[plan]

    let finalAmount: number = newPlanPrice

    if (user.isSubscriptionActive && user.subscriptionUntil && end.isAfter(now)) {
      const daysRemaining = end.diff(now, 'day', true)
      const daysInMonth = now.daysInMonth()

      const currentPlanPrice = SUBSCRIPTION_PLAN_PRICES[user.subscriptionId]

      const unusedValue = currentPlanPrice * (daysRemaining / daysInMonth)
      finalAmount = newPlanPrice - unusedValue

      if (finalAmount < 2) finalAmount = 2
    }

    const description = `Kanway | Подписка - ${this._getPlanLabel(plan)}`
    const itemId = SUBSCRIPTION_PLAN_TO_ITEM_ID[plan]
    const amountStr = finalAmount.toFixed(2)

    return this._initiateCheckoutPayment(
      {
        description,
        amount: amountStr,
        currency: 'RUB',
        column: PaymentTypeEnum.SUBSCRIPTION,
        itemId,
        status: PaymentStatusesEnum.pending,
      },
      user,
      (paymentModelId) =>
        this._getSubscriptionPayload(user, amountStr, description, paymentModelId, itemId),
    )
  }

  public async buySubscription(user: IUser, plan: SubscriptionPlanEnum) {
    if (user.subscriptionId !== SubscriptionPlanEnum.Basic && user.isSubscriptionActive) {
      throw new AppError('Пользователь уже имеет активную подписку', 500)
    }

    const description = `Kanway | Подписка - ${this._getPlanLabel(plan)}`
    const amount = this._getSubscriptionAmount(plan)
    const itemId = SUBSCRIPTION_PLAN_TO_ITEM_ID[plan]

    return this._initiateCheckoutPayment(
      {
        description,
        amount,
        currency: 'RUB',
        column: PaymentTypeEnum.SUBSCRIPTION,
        itemId,
        status: PaymentStatusesEnum.pending,
      },
      user,
      (paymentModelId) =>
        this._getSubscriptionPayload(user, amount, description, paymentModelId, itemId),
    )
  }

  public async edit(
    data: Omit<PaymentEditDTO, 'id'>,
    criteria: IPaymentCriteria,
    user: IUser,
  ): Promise<IPayment[]> {
    const updatePaymentResult = await this.repository.updateManyByCriteria(
      criteria,
      data,
      undefined,
      user.id,
    )

    if (updatePaymentResult.modifiedCount === 0) {
      throw new Error('Платежи не найдены')
    }

    return this.getByCriteria(criteria)
  }

  public async delete(
    criteria: IPaymentCriteria,
    user: IUser,
    session?: ClientSession,
  ): Promise<DeleteResult> {
    return this.repository.deleteMany(criteria, user.id, session)
  }

  public async cancelSubscription(user: IUser) {
    if (!user.isSubscriptionActive) {
      throw new AppError('У пользователя нет активной подписки', 500)
    }

    return this.userService.edit(
      {
        isSubscriptionActive: false,
        pendingChangePlan: null,
      },
      { id: user.id.toString() },
    )
  }

  public async resumeSubscription(user: IUser) {
    if (user.isSubscriptionActive) {
      throw new AppError('У пользователя уже есть активная подписка', 500)
    }

    await this.userService.edit(
      {
        isSubscriptionActive: true,
      },
      { id: user.id.toString() },
    )
  }

  public async buyCredits(user: IUser, itemId: CreditItemId) {
    const pack = CREDIT_PACKS_DATA[itemId]
    const description = `Kanway | Пакет: ${pack.label}`
    const amount = pack.amount

    return this._initiateCheckoutPayment(
      {
        description,
        amount,
        currency: 'RUB',
        column: PaymentTypeEnum.CREDIT_PACK,
        itemId,
        status: PaymentStatusesEnum.pending,
      },
      user,
      (paymentModelId) =>
        this._getCreditPackPayload(user, itemId, amount, description, paymentModelId),
    )
  }

  public async tryAgain(user: IUser, paymentId: string) {
    const payments = await this.getByCriteria({ id: paymentId })

    if (payments.length === 0) {
      throw new AppError(ErrorMessages.PAYMENT_NOT_FOUND, 500)
    }

    const paymentModel = payments[0]

    if (paymentModel.userId.toString() !== user.id.toString()) {
      throw new AppError(ErrorMessages.PAYMENT_NOT_FOUND, 500)
    }

    const { description, amount, currency, column, itemId } = paymentModel

    if (column === PaymentTypeEnum.CREDIT_PACK) {
      return this._initiateCheckoutPayment(
        {
          description,
          amount,
          currency,
          column: PaymentTypeEnum.CREDIT_PACK,
          itemId,
          status: PaymentStatusesEnum.pending,
        },
        user,
        (paymentModelId) =>
          this._getCreditPackPayload(
            user,
            itemId as CreditItemId,
            amount,
            description,
            paymentModelId,
          ),
      )
    } else {
      return this._initiateCheckoutPayment(
        {
          description,
          amount,
          currency,
          column: PaymentTypeEnum.SUBSCRIPTION,
          itemId,
          status: PaymentStatusesEnum.pending,
        },
        user,
        (paymentModelId) =>
          this._getSubscriptionPayload(
            user,
            amount,
            description,
            paymentModelId,
            itemId as PaymentItemIdEnum,
          ),
      )
    }
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

    if (!user) return

    if (!user.isSubscriptionActive || !user.paymentMethodId) {
      return this._revertToBasicPlan(userId)
    }

    const paymentMethods = await this.paymentMethodService.getByCriteria(
      { id: user.paymentMethodId },
      user.id,
    )

    if (paymentMethods.length === 0) return this._revertToBasicPlan(userId)

    const paymentMethod = paymentMethods[0]

    const targetPlan = user.pendingChangePlan ?? user.subscriptionId

    if (targetPlan === SubscriptionPlanEnum.Basic) {
      return this._revertToBasicPlan(userId)
    }

    const description = `Kanway | Подписка - ${this._getPlanLabel(targetPlan)}`
    const amount = this._getSubscriptionAmount(targetPlan)
    const itemId = SUBSCRIPTION_PLAN_TO_ITEM_ID[targetPlan]

    const dateKey = dayjs().format('YYYY-MM-DD')
    const idempotenceKey = `auto_${userId}_${dateKey}_try_${user.paymentRetriesCount || 0}`

    const paymentModel = await this.create(
      {
        description,
        amount,
        currency: 'RUB',
        column: PaymentTypeEnum.SUBSCRIPTION,
        itemId,
        status: PaymentStatusesEnum.pending,
      },
      user.id,
    )

    const payment = await this.checkout.createPayment(
      {
        amount: { value: amount, currency: 'RUB' },
        capture: true,
        payment_method_id: paymentMethod.serviceId,
        description,
      },
      idempotenceKey,
    )

    const updateResult = await this.edit(
      { serviceId: payment.id },
      { id: paymentModel.id.toString() },
      user,
    )

    return { payment, model: updateResult[0] }
  }

  private async _updateSubscriptionAndNotifyUser(
    checkedPayment: Payment,
    paymentModel: IPayment,
    session: ClientSession,
    user: IUser,
  ): Promise<PostCommitAction[]> {
    const nextBillingDate = dayjs().add(1, 'month').toDate()
    const itemId = paymentModel.itemId as SubscriptionItemId
    const creditsAmount = SUBSCRIPTION_PLAN_TO_CREDITS[SUBSCRIPTION_ITEM_ID_TO_PLAN[itemId]]

    await this.userService.edit(
      {
        subscriptionId: SUBSCRIPTION_ITEM_ID_TO_PLAN[itemId],
        paymentRetriesCount: 0,
        isSubscriptionActive: true,
        pendingChangePlan: null,
        subscriptionUntil: nextBillingDate,
      },
      { id: paymentModel.userId.toString() },
      undefined,
      session,
    )

    await this.userService.addCredits(user.id.toString(), creditsAmount, false, session)

    if (checkedPayment?.payment_method?.id) {
      let [paymentMethod] = await this.paymentMethodService.getByCriteria(
        { serviceId: checkedPayment.payment_method.id },
        user.id,
        session,
      )

      if (!paymentMethod) {
        ;[paymentMethod] = await this.paymentMethodService.create(
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
      }

      await this.userService.edit(
        { paymentMethodId: paymentMethod.id.toString() },
        { id: user.id.toString() },
        undefined,
        session,
      )
    }

    const subscriptionName = this._getPlanLabel(SUBSCRIPTION_ITEM_ID_TO_PLAN[itemId])

    return [
      () =>
        this.emailService.sendPaymentSubSuccessEmail(user, {
          purpose: `Подписка - ${subscriptionName}`,
          amount: paymentModel.amount,
          date: dayjs().toISOString(),
          next_billing_date: nextBillingDate.toISOString(),
        }),
    ]
  }

  private async _handleSuccessNotification(
    checkedPayment: Payment,
    paymentModel: IPayment,
    session: ClientSession,
    user: IUser,
  ): Promise<PostCommitAction[]> {
    const metadata = checkedPayment.metadata
    const isCreditPack = metadata?.paymentType === PaymentTypeEnum.CREDIT_PACK
    if (isCreditPack) {
      const itemId = paymentModel.itemId as CreditItemId
      const creditsToAdd = CREDIT_PACKS_DATA[itemId].credits

      await this.userService.addCredits(user.id.toString(), creditsToAdd, true, session)

      const creditPackLabel = CREDIT_PACKS_DATA[itemId].label

      return [
        () =>
          this.emailService.sendPaymentCreditsSuccessEmail(user, {
            purpose: creditPackLabel,
            amount: paymentModel.amount,
            date: dayjs().toISOString(),
          }),
      ]
    } else {
      return await this._updateSubscriptionAndNotifyUser(
        checkedPayment,
        paymentModel,
        session,
        user,
      )
    }
  }

  private async _handleCanceledNotification(
    paymentModel: IPayment,
    session: ClientSession,
    user: IUser,
  ): Promise<PostCommitAction[]> {
    if (paymentModel.column === PaymentTypeEnum.CREDIT_PACK) return []
    if (!user.isSubscriptionActive) return []

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

      return [() => this.emailService.sendPaymentFinalFailedEmail(user)]
    } else {
      let daysLeft = ''

      if (newCount === 1) {
        daysLeft = '3'
      } else if (newCount === 2) {
        daysLeft = '2'
      }

      return [() => this.emailService.sendPaymentFailedEmail(user, paymentModel.amount, daysLeft)]
    }
  }

  public async handleNotification(notification: {
    id: string
    event: WebHookEvents
    object: Payment
  }) {
    const payment = notification.object

    const payments = await this.getByCriteria({
      serviceId: payment.id,
    })

    if (payments.length === 0) {
      throw new AppError(ErrorMessages.PAYMENT_NOT_FOUND, 500)
    }

    const paymentModel = payments[0]

    if (
      paymentModel.status === PaymentStatusesEnum.succeeded ||
      paymentModel.status === PaymentStatusesEnum.canceled
    ) {
      return
    }

    const checkedPayment = await this.checkout.getPayment(payment.id)

    if (!checkedPayment) {
      throw new AppError(ErrorMessages.PAYMENT_NOT_FOUND, 500)
    }

    const session = await mongoose.startSession()
    let postCommitActions: PostCommitAction[] = []
    session.startTransaction()

    try {
      const user = await this.userService.getById(paymentModel.userId.toString(), session)

      if (!user) {
        throw new AppError(ErrorMessages.USER_NOT_FOUND, 500)
      }

      const updateResult = await this.repository.updateManyByCriteria(
        {
          id: paymentModel.id.toString(),
          statusesNot: [PaymentStatusesEnum.succeeded, PaymentStatusesEnum.canceled],
        },
        { status: checkedPayment.status as PaymentStatusesEnum },
        session,
      )

      if (updateResult.modifiedCount === 0) {
        await session.abortTransaction()
        return
      }

      if (checkedPayment.status === 'succeeded') {
        postCommitActions = await this._handleSuccessNotification(
          checkedPayment,
          paymentModel,
          session,
          user,
        )
      } else if (checkedPayment.status === 'canceled') {
        postCommitActions = await this._handleCanceledNotification(paymentModel, session, user)
      }

      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }

    const results = await Promise.allSettled(postCommitActions.map((action) => action()))

    results.forEach((result) => {
      if (result.status === 'rejected') {
        Sentry.captureException(result.reason)
      }
    })
  }
}
