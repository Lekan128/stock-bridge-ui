const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return currencyFormatter.format(value)
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value))
}
