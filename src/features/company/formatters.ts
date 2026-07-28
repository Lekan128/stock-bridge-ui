import type { PaymentTerms } from '@/features/company/types'

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

const PAYMENT_TERMS_DESCRIPTIONS: Record<PaymentTerms, string> = {
  PREPAID: 'Marketplace orders must be paid for before they are fulfilled.',
  PAY_ON_DELIVERY_ALLOWED:
    'ProcurePal has extended credit terms to this company — pay on delivery may be offered at checkout.',
}

export function describePaymentTerms(terms: PaymentTerms): string {
  return PAYMENT_TERMS_DESCRIPTIONS[terms] ?? ''
}
