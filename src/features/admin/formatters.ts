import type { PaymentTerms } from '@/features/admin/types'

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  PREPAID: 'Prepaid',
  PAY_ON_DELIVERY_ALLOWED: 'Pay on delivery allowed',
}

/** Falls back to the raw code so a term added to the backend later still renders something. */
export function formatPaymentTerms(terms: PaymentTerms): string {
  return PAYMENT_TERMS_LABELS[terms] ?? terms
}

/** The full enum, in the order an ops user should read it: no credit first, then credit. */
export const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string; description: string }[] = [
  {
    value: 'PREPAID',
    label: 'Prepaid',
    description: 'Orders must be paid for before fulfilment. The default for every new signup.',
  },
  {
    value: 'PAY_ON_DELIVERY_ALLOWED',
    label: 'Pay on delivery allowed',
    description:
      'Extends credit to this customer. Pay on delivery may then be offered at checkout, subject to the marketplace settings.',
  },
]
