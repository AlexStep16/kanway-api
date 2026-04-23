import { PaymentItemIdEnum } from '@/domain/enums/PaymentItemIdEnum.js'

export const CREDIT_PACKS_DATA = {
  [PaymentItemIdEnum.CREDIT_PACK_SMALL]: { amount: '299.00', credits: 100, label: '100 кредитов' },
  [PaymentItemIdEnum.CREDIT_PACK_MEDIUM]: { amount: '699.00', credits: 300, label: '300 кредитов' },
  [PaymentItemIdEnum.CREDIT_PACK_LARGE]: {
    amount: '1999.00',
    credits: 1000,
    label: '1000 кредитов',
  },
}
