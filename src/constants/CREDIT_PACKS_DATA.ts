import { PaymentItemIdEnum } from '@/domain/enums/PaymentItemIdEnum.js'

export const CREDIT_PACKS_DATA = {
  [PaymentItemIdEnum.CREDIT_PACK_SMALL]: {
    amount: '299.00',
    credits: 3000,
    label: '3000 кредитов',
  },
  [PaymentItemIdEnum.CREDIT_PACK_MEDIUM]: {
    amount: '699.00',
    credits: 7000,
    label: '7000 кредитов',
  },
  [PaymentItemIdEnum.CREDIT_PACK_LARGE]: {
    amount: '1999.00',
    credits: 20000,
    label: '20000 кредитов',
  },
}
