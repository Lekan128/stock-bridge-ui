import { formatNaira } from '@/utils/money'

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * Delegates to the shared NGN formatter. Kept as a named re-export rather than deleted so the
 * dozen existing call sites in the products feature don't all have to change — but there is now
 * exactly one place that decides what money looks like, and it is `utils/money.ts`.
 */
export function formatCurrency(value: number | null | undefined): string {
  return formatNaira(value)
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value))
}
