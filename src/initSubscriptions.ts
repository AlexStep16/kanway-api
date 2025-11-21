import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.ts'
import SubscriptionRepository from '@repositories/SubscriptionRepository.ts'
import { SubscriptionService } from '@application/services/SubscriptionService.ts'
import Subscription from '@models/SubscriptionModel.ts'
import { ISubscription } from '@entities/ISubscription.ts'
import { PaymentStatusEnum } from '@domain/enums/PaymentStatusEnum.ts'
import { PaymentDTO } from '@dtos/PaymentDTO.ts'
import PaymentRepository from './application/repositories/PaymentRepository.ts'
import { PaymentService } from './application/services/PaymentService.ts'
import { PaymentMethodDTO } from './application/dtos/PaymentMethodDTO.ts'
import PaymentMethodRepository from './application/repositories/PaymentMethodRepository.ts'
import { PaymentMethodService } from './application/services/PaymentMethodService.ts'
import { Types } from 'mongoose'

const subscriptions: ISubscription[] = [
  {
    id: SubscriptionPlanEnum.Basic,
    name: 'Базовая',
    price: 0,
    currency: 'RUB',
    interval: 'month',
    limitWorkspaces: 1,
    limitBoards: 5,
    limitAiMessagesPerMonth: 20,
  },
  {
    id: SubscriptionPlanEnum.Premium,
    name: 'Премиум',
    price: 599,
    currency: 'RUB',
    interval: 'month',
    limitWorkspaces: -1,
    limitBoards: -1,
    limitAiMessagesPerMonth: 300,
  },
  {
    id: SubscriptionPlanEnum.Business,
    name: 'Бизнес',
    price: 999,
    currency: 'RUB',
    interval: 'month',
    limitWorkspaces: -1,
    limitBoards: -1,
    limitAiMessagesPerMonth: 9999,
  },
]

const payments: PaymentDTO[] = [
  {
    description: 'Премиум подписка',
    amount: 599,
    currency: 'RUB',
    status: PaymentStatusEnum.COMPLETED,
    userId: '67da84f0a2e3729760781559',
  },
  {
    description: 'Премиум подписка',
    amount: 599,
    currency: 'RUB',
    status: PaymentStatusEnum.PENDING,
    userId: '67da84f0a2e3729760781559',
  },
  {
    description: 'Премиум подписка',
    amount: 599,
    currency: 'RUB',
    status: PaymentStatusEnum.FAILED,
    userId: '67da84f0a2e3729760781559',
  },
]

const paymentMethods: PaymentMethodDTO[] = [
  {
    serviceId: 'pm_1',
    type: 'card',
    cardFirst6: '424242',
    cardLast4: '4242',
    expiryMonth: 12,
    expiryYear: 2025,
    cardType: 'Visa',
    last4: '4242',
    userId: '67da84f0a2e3729760781559',
  },
  {
    serviceId: 'pm_2',
    type: 'card',
    cardFirst6: '555555',
    cardLast4: '5555',
    expiryMonth: 11,
    expiryYear: 2024,
    cardType: 'MasterCard',
    last4: '5555',
    userId: '67da84f0a2e3729760781559',
  },
]

export async function initSubscriptions(): Promise<void> {
  const existingSubscriptions = await Subscription.find().lean()
  const subscriptionRepository = new SubscriptionRepository()
  const subscriptionService = new SubscriptionService(subscriptionRepository)

  const paymentRepository = new PaymentRepository()
  const paymentService = new PaymentService(paymentRepository)
  const existingPayments = await paymentService.getAllByUserId(
    new Types.ObjectId('67da84f0a2e3729760781559')
  )

  const paymentMethodRepository = new PaymentMethodRepository()
  const paymentMethodService = new PaymentMethodService(paymentMethodRepository)
  const existingPaymentMethods = await paymentMethodService.getAllByUserId(
    new Types.ObjectId('67da84f0a2e3729760781559')
  )
  if (existingSubscriptions.length === 0) {
    for (const subscriptionData of subscriptions) {
      await subscriptionService.create(subscriptionData)
    }
  }

  if (existingPayments.length === 0) {
    for (const paymentData of payments) {
      await paymentService.create(paymentData, new Types.ObjectId('67da84f0a2e3729760781559'))
    }
  }

  if (existingPaymentMethods.length === 0) {
    for (const paymentMethodData of paymentMethods) {
      await paymentMethodService.create(
        paymentMethodData,
        new Types.ObjectId('67da84f0a2e3729760781559')
      )
    }
  }
}
